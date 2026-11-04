-- Security hardening (review items M1, L9, M2, L8, L11).
--
-- Admin-only data stays in place but is hidden from the API roles with column-level SELECT grants.
-- Admins use the same `authenticated` role, so they read those columns only through the
-- `admin_get_order` security definer RPC:
--   orders.admin_note                  internal memo
--   order_events.actor_id, .note       who acted (admin UUIDs) and admin notes (refund account, …)
--   site_settings.updated_by           admin UUID
-- Customers keep every other column of their own orders (cancel_reason shows their cancel request).

-- M1 / L9: column-level SELECT --------------------------------------------------------------------

revoke select on public.orders from authenticated;
grant select (
  id, order_no, user_id, status, payment_method, subtotal, shipping_fee, total,
  recipient, phone, postal_code, address1, address2, memo, depositor_name,
  bank_name, bank_account, bank_holder, payment_due_at,
  paid_at, shipped_at, delivered_at, cancelled_at, refunded_at,
  cancel_reason, cancel_requested_at, carrier, tracking_no, created_at, updated_at
) on public.orders to authenticated;

revoke select on public.order_events from authenticated;
grant select (id, order_id, from_status, to_status, created_at) on public.order_events to authenticated;

revoke select on public.site_settings from anon, authenticated;
grant select (
  id, shipping_fee, free_shipping_threshold, bank_name, bank_account, bank_holder,
  payment_due_hours, updated_at
) on public.site_settings to anon, authenticated;

-- Admin order detail: the full order (admin_note included), lines (id order), every event with
-- actor and note (oldest first) and the orderer's profile (null once the account is deleted).
-- Returns null when the order does not exist.
create or replace function public.admin_get_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  return (
    select to_jsonb(o) || jsonb_build_object(
      'items', coalesce(
        (select jsonb_agg(to_jsonb(i) order by i.id) from public.order_items i where i.order_id = o.id),
        '[]'::jsonb
      ),
      'events', coalesce(
        (select jsonb_agg(to_jsonb(e) order by e.created_at, e.id) from public.order_events e where e.order_id = o.id),
        '[]'::jsonb
      ),
      'customer', (
        select jsonb_build_object('id', p.id, 'name', p.name, 'email', p.email, 'phone', p.phone)
          from public.profiles p
         where p.id = o.user_id
      )
    )
      from public.orders o
     where o.id = p_order_id
  );
end;
$$;
revoke all on function public.admin_get_order(uuid) from public, anon, authenticated;
grant execute on function public.admin_get_order(uuid) to authenticated;

-- M1: the admin's cancel note (refund account and amount) stays in order_events.note only.
-- cancel_reason, which the customer can read, keeps the customer's own request or a fixed text.
create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_note text := btrim(coalesce(p_note, ''));
begin
  if not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if char_length(v_note) > 500 or p_status is null then
    raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
  end if;

  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
  end if;

  if v_order.status = 'pending_payment' and p_status = 'paid' then
    update public.orders set status = 'paid', paid_at = now() where id = v_order.id;

  elsif v_order.status = 'pending_payment' and p_status = 'cancelled' then
    update public.orders
       set status = 'cancelled', cancelled_at = now(), cancel_reason = '관리자 취소'
     where id = v_order.id;
    perform public.restore_order_stock(v_order.id);

  elsif v_order.status = 'paid' and p_status = 'preparing' then
    update public.orders set status = 'preparing' where id = v_order.id;

  elsif v_order.status in ('paid', 'preparing') and p_status = 'shipped' then
    if coalesce(btrim(v_order.carrier), '') = '' or coalesce(btrim(v_order.tracking_no), '') = '' then
      raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
    end if;
    update public.orders set status = 'shipped', shipped_at = now() where id = v_order.id;

  elsif v_order.status = 'shipped' and p_status = 'delivered' then
    update public.orders set status = 'delivered', delivered_at = now() where id = v_order.id;

  elsif v_order.status in ('paid', 'preparing') and p_status = 'cancelled' then
    if v_note = '' then
      raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
    end if;
    update public.orders
       set status = 'cancelled', cancelled_at = now(), cancel_reason = coalesce(v_order.cancel_reason, '관리자 취소')
     where id = v_order.id;
    perform public.restore_order_stock(v_order.id);

  elsif v_order.status = 'cancelled' and p_status = 'refunded' and v_order.paid_at is not null then
    update public.orders set status = 'refunded', refunded_at = now() where id = v_order.id;

  else
    raise exception using message = 'INVALID_TRANSITION', errcode = 'P0001';
  end if;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (v_order.id, auth.uid(), v_order.status, p_status, v_note);
end;
$$;
revoke all on function public.admin_update_order_status(uuid, public.order_status, text) from public, anon, authenticated;
grant execute on function public.admin_update_order_status(uuid, public.order_status, text) to authenticated;

-- M2: per-customer order limits ------------------------------------------------------------------
-- Unpaid orders hold stock for payment_due_hours. A customer may have at most 3 pending_payment
-- orders (TOO_MANY_PENDING) and place at most 10 orders per rolling hour (TOO_MANY_ORDERS).
-- A per-user advisory lock serialises concurrent calls so parallel requests cannot pass the count.
-- Everything else is unchanged from 0004.
create or replace function public.create_order(
  p_items jsonb,
  p_address jsonb,
  p_memo text,
  p_depositor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  c_max_pending constant integer := 3;
  c_max_per_hour constant integer := 10;
  v_user uuid := auth.uid();
  v_item jsonb;
  v_key text;
  v_qty jsonb := '{}'::jsonb;
  v_ids uuid[];
  v_found uuid[] := '{}'::uuid[];
  v_missing uuid;
  v_row record;
  v_unit integer;
  v_subtotal integer := 0;
  v_shipping integer;
  v_settings public.site_settings;
  v_order public.orders;
  v_count integer;
  v_attempt integer := 0;
  v_recipient text;
  v_phone text;
  v_postal text;
  v_addr1 text;
  v_addr2 text;
  v_memo text := btrim(coalesce(p_memo, ''));
  v_depositor text := btrim(coalesce(p_depositor_name, ''));
begin
  if v_user is null then
    raise exception using message = 'AUTH_REQUIRED', errcode = 'P0001';
  end if;

  -- 1. per-customer limits
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('create_order:' || v_user::text, 0));
  if (
    select count(*) from public.orders o where o.user_id = v_user and o.status = 'pending_payment'
  ) >= c_max_pending then
    raise exception using message = 'TOO_MANY_PENDING', errcode = 'P0001';
  end if;
  if (
    select count(*) from public.orders o where o.user_id = v_user and o.created_at > now() - interval '1 hour'
  ) >= c_max_per_hour then
    raise exception using message = 'TOO_MANY_ORDERS', errcode = 'P0001';
  end if;

  -- 2. input validation
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) not between 1 and 50 then
    raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
  end if;
  for v_item in select e.value from jsonb_array_elements(p_items) e loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
    end if;
    v_key := lower(coalesce(v_item ->> 'variant_id', ''));
    if v_key !~ c_uuid or v_qty ? v_key then
      raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
    end if;
    if jsonb_typeof(v_item -> 'quantity') is distinct from 'number'
       or (v_item ->> 'quantity') !~ '^[0-9]{1,2}$' then
      raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
    end if;
    if (v_item ->> 'quantity')::integer not between 1 and 10 then
      raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
    end if;
    v_qty := v_qty || jsonb_build_object(v_key, (v_item ->> 'quantity')::integer);
  end loop;
  select array_agg(k::uuid order by k::uuid) into v_ids from jsonb_object_keys(v_qty) k;

  if p_address is null or jsonb_typeof(p_address) <> 'object' then
    raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
  end if;
  v_recipient := btrim(coalesce(p_address ->> 'recipient', ''));
  v_phone := btrim(coalesce(p_address ->> 'phone', ''));
  v_postal := btrim(coalesce(p_address ->> 'postal_code', ''));
  v_addr1 := btrim(coalesce(p_address ->> 'address1', ''));
  v_addr2 := btrim(coalesce(p_address ->> 'address2', ''));
  if char_length(v_recipient) not between 1 and 40
     or v_phone !~ '^01[0-9]{8,9}$'
     or v_postal !~ '^[0-9]{5}$'
     or char_length(v_addr1) not between 1 and 120
     or char_length(v_addr2) > 120
     or char_length(v_memo) > 200
     or char_length(v_depositor) not between 1 and 20 then
    raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
  end if;

  -- 3. lock variants (id order) and validate availability/stock; 4. compute prices server-side
  for v_row in
    select v.id, v.stock, v.price_delta, v.is_active, p.price, p.status
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = any (v_ids)
     order by v.id
       for update of v
  loop
    v_found := v_found || v_row.id;
    v_unit := v_row.price + v_row.price_delta;
    if v_row.status <> 'active' or not v_row.is_active or v_unit < 0 then
      raise exception using message = 'ITEM_UNAVAILABLE', detail = v_row.id::text, errcode = 'P0001';
    end if;
    if v_row.stock < (v_qty ->> v_row.id::text)::integer then
      raise exception using message = 'OUT_OF_STOCK', detail = v_row.id::text, errcode = 'P0001';
    end if;
    v_subtotal := v_subtotal + v_unit * (v_qty ->> v_row.id::text)::integer;
  end loop;
  if cardinality(v_found) <> cardinality(v_ids) then
    select x into v_missing from unnest(v_ids) x where x <> all (v_found) limit 1;
    raise exception using message = 'ITEM_UNAVAILABLE', detail = v_missing::text, errcode = 'P0001';
  end if;

  -- 5. settings snapshot
  select * into v_settings from public.site_settings s where s.id = 1;
  if not found or v_settings.bank_account = '' then
    raise exception using message = 'BANK_NOT_CONFIGURED', errcode = 'P0001';
  end if;
  v_shipping := case
    when v_settings.free_shipping_threshold is not null and v_subtotal >= v_settings.free_shipping_threshold then 0
    else v_settings.shipping_fee
  end;

  -- 6. order row (order_no collision → retry up to 5 times)
  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.orders (
        order_no, user_id, status, subtotal, shipping_fee, total,
        recipient, phone, postal_code, address1, address2, memo, depositor_name,
        bank_name, bank_account, bank_holder, payment_due_at
      )
      values (
        public.generate_order_no(), v_user, 'pending_payment', v_subtotal, v_shipping, v_subtotal + v_shipping,
        v_recipient, v_phone, v_postal, v_addr1, v_addr2, v_memo, v_depositor,
        v_settings.bank_name, v_settings.bank_account, v_settings.bank_holder,
        now() + make_interval(hours => v_settings.payment_due_hours)
      )
      returning * into v_order;
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise;
      end if;
    end;
  end loop;

  -- 7. line items (snapshot name/label/sku/price; image prefers the variant colour)
  insert into public.order_items (order_id, product_id, variant_id, product_name, variant_label, sku, unit_price, quantity, image_path)
  select v_order.id,
         p.id,
         v.id,
         p.name,
         concat_ws(' / ', nullif(v.color, ''), nullif(v.size, '')),
         v.sku,
         p.price + v.price_delta,
         (v_qty ->> v.id::text)::integer,
         (
           select i.storage_path
             from public.product_images i
            where i.product_id = p.id
            order by coalesce(i.color = v.color, false) desc, i.sort, i.created_at
            limit 1
         )
    from public.product_variants v
    join public.products p on p.id = v.product_id
   where v.id = any (v_ids)
   order by v.id;

  -- 8. stock decrement (rows are locked; the guard keeps the invariant explicit)
  update public.product_variants v
     set stock = v.stock - q.qty
    from (select e.key::uuid as id, e.value::integer as qty from jsonb_each_text(v_qty) e) q
   where v.id = q.id
     and v.stock >= q.qty;
  get diagnostics v_count = row_count;
  if v_count <> cardinality(v_ids) then
    raise exception using message = 'OUT_OF_STOCK', errcode = 'P0001';
  end if;

  -- 9. event
  insert into public.order_events (order_id, actor_id, from_status, to_status)
  values (v_order.id, v_user, null, 'pending_payment');

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_no', v_order.order_no,
    'total', v_order.total,
    'payment_due_at', v_order.payment_due_at,
    'bank', jsonb_build_object(
      'bank_name', v_order.bank_name,
      'bank_account', v_order.bank_account,
      'bank_holder', v_order.bank_holder
    )
  );
end;
$$;
revoke all on function public.create_order(jsonb, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb, text, text) to authenticated;

-- L8: marketing consent time is decided by the server ----------------------------------------------
-- Clients still write marketing_agreed_at (any non-null value means "agree", null withdraws), but
-- the stored time is the moment consent was first given since the last withdrawal.
create or replace function public.stamp_marketing_consent()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.marketing_agreed_at is not null then
    new.marketing_agreed_at := coalesce(old.marketing_agreed_at, now());
  end if;
  return new;
end;
$$;
revoke all on function public.stamp_marketing_consent() from public, anon, authenticated;

create trigger stamp_marketing_consent before update of marketing_agreed_at on public.profiles
  for each row
  when (old.marketing_agreed_at is distinct from new.marketing_agreed_at)
  execute function public.stamp_marketing_consent();

-- L11: no personal data in audit_logs -------------------------------------------------------------
-- Order rows are audited without the recipient snapshot and free-text fields. An update that
-- changes only those fields is still logged, with the changed field names in after.redacted_changed.
create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_order_private constant text[] := array[
    'recipient', 'phone', 'postal_code', 'address1', 'address2', 'memo', 'depositor_name',
    'cancel_reason', 'admin_note'
  ];
  v_before jsonb;
  v_after jsonb;
  v_redacted text[];
begin
  if tg_op = 'INSERT' then
    v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    if (v_before - 'updated_at') = (v_after - 'updated_at') then
      return null;
    end if;
    if tg_table_name = 'product_variants'
       and (v_before - array['stock', 'updated_at']) = (v_after - array['stock', 'updated_at'])
       and not public.is_admin() then
      return null;
    end if;
  else
    v_before := to_jsonb(old);
  end if;

  if tg_table_name = 'orders' then
    if tg_op = 'UPDATE' then
      select array_agg(k order by k) into v_redacted
        from unnest(c_order_private) k
       where v_before -> k is distinct from v_after -> k;
    end if;
    v_before := v_before - c_order_private;
    v_after := v_after - c_order_private;
    if v_redacted is not null then
      v_after := v_after || jsonb_build_object('redacted_changed', to_jsonb(v_redacted));
    end if;
  end if;

  insert into public.audit_logs (actor_id, action, table_name, row_id, before, after)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(v_after ->> 'id', v_before ->> 'id', ''),
    v_before,
    v_after
  );
  return null;
end;
$$;
revoke all on function public.log_audit() from public, anon, authenticated;

-- Account deletion leaves only "this account id was deleted at this time". The former unsalted
-- sha256 of e-mail and name had no reader and re-identified anyone whose e-mail is known.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception using message = 'AUTH_REQUIRED', errcode = 'P0001';
  end if;

  if exists (
    select 1
      from public.orders o
     where o.user_id = v_user
       and o.status in ('pending_payment', 'paid', 'preparing', 'shipped')
  ) then
    raise exception using message = 'ACTIVE_ORDERS', errcode = 'P0001';
  end if;

  delete from public.addresses where user_id = v_user;
  delete from public.wishlist_items where user_id = v_user;
  update public.orders set user_id = null where user_id = v_user;

  insert into public.audit_logs (actor_id, action, table_name, row_id, before, after)
  values (v_user, 'ACCOUNT_DELETED', 'profiles', v_user::text, null, null);

  delete from auth.users where id = v_user;  -- profiles/admins cascade
end;
$$;
revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- Scrub rows written before this migration.
update public.audit_logs
   set before = before - array[
         'recipient', 'phone', 'postal_code', 'address1', 'address2', 'memo', 'depositor_name',
         'cancel_reason', 'admin_note'
       ],
       after = after - array[
         'recipient', 'phone', 'postal_code', 'address1', 'address2', 'memo', 'depositor_name',
         'cancel_reason', 'admin_note'
       ]
 where table_name = 'orders';
update public.audit_logs set before = null, after = null where action = 'ACCOUNT_DELETED';
