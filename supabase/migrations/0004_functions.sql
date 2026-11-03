-- All functions pin `search_path = ''` and reference objects schema-qualified.
-- Errors raised to clients use `errcode = 'P0001'` and a stable CODE in `message`
-- (mapped to Korean text in src/lib/rpcErrors.ts); `detail` carries a variant_id where relevant.
-- Supabase grants EXECUTE on new public functions to anon/authenticated by default, so every
-- function below revokes it explicitly and grants back only what the client needs.

-- Auth helpers -----------------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- Generic triggers -------------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- Keeps at most one default address per user. Runs as the caller: RLS already restricts the
-- caller to their own rows, so no elevated privilege is needed.
create or replace function public.ensure_single_default_address()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.is_default then
    update public.addresses
       set is_default = false
     where user_id = new.user_id
       and id <> new.id
       and is_default;
  end if;
  return new;
end;
$$;
revoke all on function public.ensure_single_default_address() from public, anon, authenticated;

-- site_settings.updated_by is always the editing user, never a client-supplied value.
create or replace function public.set_settings_updated_by()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke all on function public.set_settings_updated_by() from public, anon, authenticated;

-- Creates the profile row for every new auth user. Signup fails unless both required consents are true.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text := btrim(coalesce(v_meta ->> 'name', ''));
  v_phone text := nullif(regexp_replace(coalesce(v_meta ->> 'phone', ''), '[^0-9]', '', 'g'), '');
begin
  if v_meta -> 'terms_agreed' is distinct from 'true'::jsonb
     or v_meta -> 'privacy_agreed' is distinct from 'true'::jsonb then
    raise exception using message = 'TERMS_REQUIRED', errcode = 'P0001';
  end if;

  insert into public.profiles (id, email, name, phone, terms_agreed_at, privacy_agreed_at, marketing_agreed_at)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(v_name, ''), left(split_part(coalesce(new.email, ''), '@', 1), 40)),
    v_phone,
    now(),
    now(),
    case when v_meta -> 'marketing_agreed' = 'true'::jsonb then now() end
  );
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;
revoke all on function public.handle_user_email_update() from public, anon, authenticated;

-- Audit trail for catalog, orders, settings and home sections.
-- Skipped: no-op updates, and stock-only variant updates made by non-admins
-- (order placement/cancellation/expiry; those are traced in order_events).
create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
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

-- Orders: internal helpers -----------------------------------------------------------------------

-- 'YYYYMMDD-XXXXXX' (Asia/Seoul date + 6 Crockford base32 chars; 256 % 32 = 0 so no modulo bias).
create or replace function public.generate_order_no()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_bytes bytea := extensions.gen_random_bytes(6);
  v_suffix text := '';
begin
  for i in 0..5 loop
    v_suffix := v_suffix || substr(c_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return to_char(now() at time zone 'Asia/Seoul', 'YYYYMMDD') || '-' || v_suffix;
end;
$$;
revoke all on function public.generate_order_no() from public, anon, authenticated;

create or replace function public.restore_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- lock in id order (same order as create_order) to avoid deadlocks
  perform 1
     from public.product_variants v
    where v.id in (select oi.variant_id from public.order_items oi where oi.order_id = p_order_id)
    order by v.id
      for update;

  update public.product_variants v
     set stock = v.stock + s.qty
    from (
      select oi.variant_id, sum(oi.quantity)::integer as qty
        from public.order_items oi
       where oi.order_id = p_order_id
         and oi.variant_id is not null
       group by oi.variant_id
    ) s
   where v.id = s.variant_id;
end;
$$;
revoke all on function public.restore_order_stock(uuid) from public, anon, authenticated;

-- Orders: customer RPCs --------------------------------------------------------------------------

-- p_items:   [{ "variant_id": uuid, "quantity": 1..10 }]  (1..50 rows, unique variants; any other keys are ignored)
-- p_address: { recipient, phone, postal_code, address1, address2 }
-- Prices, shipping fee and bank account always come from the database.
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

-- pending_payment → cancelled (stock restored); paid/preparing → cancel request (status unchanged).
create or replace function public.cancel_my_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_order public.orders;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_user is null then
    raise exception using message = 'AUTH_REQUIRED', errcode = 'P0001';
  end if;
  if char_length(v_reason) > 200 then
    raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
  end if;

  select * into v_order from public.orders o where o.id = p_order_id and o.user_id = v_user for update;
  if not found then
    raise exception using message = 'CANNOT_CANCEL', errcode = 'P0001';
  end if;

  if v_order.status = 'pending_payment' then
    update public.orders
       set status = 'cancelled',
           cancelled_at = now(),
           cancel_reason = coalesce(nullif(v_reason, ''), '고객 취소')
     where id = v_order.id;
    perform public.restore_order_stock(v_order.id);
    insert into public.order_events (order_id, actor_id, from_status, to_status, note)
    values (v_order.id, v_user, 'pending_payment', 'cancelled', v_reason);
  elsif v_order.status in ('paid', 'preparing') and v_order.cancel_requested_at is null then
    if v_reason = '' then
      raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
    end if;
    update public.orders
       set cancel_requested_at = now(),
           cancel_reason = v_reason
     where id = v_order.id;
    insert into public.order_events (order_id, actor_id, from_status, to_status, note)
    values (v_order.id, v_user, v_order.status, v_order.status, '취소 요청');
  else
    raise exception using message = 'CANNOT_CANCEL', errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.cancel_my_order(uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_my_order(uuid, text) to authenticated;

-- Cancels overdue pending orders. Callable by admins (dashboard button) and by pg_cron,
-- which runs without any request JWT (auth.role() is null). Any other caller is rejected.
create or replace function public.expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_count integer := 0;
begin
  if auth.role() is not null and auth.role() <> 'service_role' and not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  for v_order in
    select *
      from public.orders o
     where o.status = 'pending_payment'
       and o.payment_due_at < now()
     order by o.id
       for update skip locked
  loop
    update public.orders
       set status = 'cancelled',
           cancelled_at = now(),
           cancel_reason = '입금 기한 만료'
     where id = v_order.id;
    perform public.restore_order_stock(v_order.id);
    insert into public.order_events (order_id, actor_id, from_status, to_status, note)
    values (v_order.id, auth.uid(), 'pending_payment', 'cancelled', '입금 기한 만료');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
revoke all on function public.expire_unpaid_orders() from public, anon, authenticated;
grant execute on function public.expire_unpaid_orders() to authenticated;

-- Orders: admin RPCs -----------------------------------------------------------------------------

-- Transition table (mirrored by ORDER_TRANSITIONS in src/types/domain.ts):
--   pending_payment → paid | cancelled (stock restored)
--   paid → preparing | shipped | cancelled (note required, stock restored)
--   preparing → shipped | cancelled (note required, stock restored)
--   shipped → delivered
--   cancelled (paid_at set) → refunded (no stock change)
-- → shipped requires carrier and tracking_no already on the order; admin_set_tracking sets both at once.
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
       set status = 'cancelled', cancelled_at = now(), cancel_reason = coalesce(nullif(v_note, ''), '관리자 취소')
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
       set status = 'cancelled', cancelled_at = now(), cancel_reason = v_note
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

-- paid/preparing → shipped with carrier + tracking number; on shipped orders only updates the tracking info.
create or replace function public.admin_set_tracking(p_order_id uuid, p_carrier text, p_tracking_no text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_carrier text := btrim(coalesce(p_carrier, ''));
  v_tracking text := btrim(coalesce(p_tracking_no, ''));
begin
  if not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if char_length(v_carrier) not between 1 and 40 or v_tracking !~ '^[0-9A-Za-z-]{1,40}$' then
    raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
  end if;

  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
  end if;

  if v_order.status in ('paid', 'preparing') then
    update public.orders
       set status = 'shipped', shipped_at = now(), carrier = v_carrier, tracking_no = v_tracking
     where id = v_order.id;
    insert into public.order_events (order_id, actor_id, from_status, to_status, note)
    values (v_order.id, auth.uid(), v_order.status, 'shipped', v_carrier || ' ' || v_tracking);
  elsif v_order.status = 'shipped' then
    update public.orders set carrier = v_carrier, tracking_no = v_tracking where id = v_order.id;
    insert into public.order_events (order_id, actor_id, from_status, to_status, note)
    values (v_order.id, auth.uid(), 'shipped', 'shipped', '송장 수정 ' || v_carrier || ' ' || v_tracking);
  else
    raise exception using message = 'INVALID_TRANSITION', errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.admin_set_tracking(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_tracking(uuid, text, text) to authenticated;

-- Catalog / dashboard admin RPCs -----------------------------------------------------------------

-- Sets sort = 0..n-1 in array order. Every id must belong to the product and appear once.
create or replace function public.reorder_product_images(p_product_id uuid, p_image_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if p_image_ids is null
     or cardinality(p_image_ids) <> (select count(distinct x) from unnest(p_image_ids) x)
     or exists (
       select 1
         from unnest(p_image_ids) x
        where not exists (select 1 from public.product_images i where i.id = x and i.product_id = p_product_id)
     ) then
    raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
  end if;

  update public.product_images i
     set sort = (o.ord - 1)::integer
    from unnest(p_image_ids) with ordinality as o (id, ord)
   where i.id = o.id
     and i.product_id = p_product_id;
end;
$$;
revoke all on function public.reorder_product_images(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_product_images(uuid, uuid[]) to authenticated;

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'counts', (
      select jsonb_build_object(
        'pending_payment', count(*) filter (where o.status = 'pending_payment'),
        'paid', count(*) filter (where o.status = 'paid'),
        'preparing', count(*) filter (where o.status = 'preparing'),
        'shipped', count(*) filter (where o.status = 'shipped')
      )
        from public.orders o
       where o.status in ('pending_payment', 'paid', 'preparing', 'shipped')
    ),
    'today_orders', (select count(*) from public.orders o where o.created_at >= v_today_start),
    'revenue_30d', (
      select coalesce(sum(o.total), 0)
        from public.orders o
       where o.status in ('paid', 'preparing', 'shipped', 'delivered')
         and o.created_at >= now() - interval '30 days'
    ),
    'low_stock', (
      select coalesce(jsonb_agg(t order by t.stock, t.product_name, t.sku), '[]'::jsonb)
        from (
          select v.id as variant_id, p.name as product_name, v.sku, v.stock
            from public.product_variants v
            join public.products p on p.id = v.product_id
           where v.stock <= 3
             and v.is_active
             and p.status <> 'archived'
           order by v.stock, p.name, v.sku
           limit 20
        ) t
    ),
    'expired_pending', (
      select count(*) from public.orders o where o.status = 'pending_payment' and o.payment_due_at < now()
    )
  );
end;
$$;
revoke all on function public.admin_dashboard_stats() from public, anon, authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;

-- Account deletion -------------------------------------------------------------------------------

-- Refuses while orders are in progress. Order rows (recipient snapshots) are retained for the
-- legally required period (전자상거래법: 계약·대금결제 기록 5년) but detached from the account.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
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

  select * into v_profile from public.profiles p where p.id = v_user;

  delete from public.addresses where user_id = v_user;
  delete from public.wishlist_items where user_id = v_user;
  update public.orders set user_id = null where user_id = v_user;

  insert into public.audit_logs (actor_id, action, table_name, row_id, before, after)
  values (
    v_user,
    'ACCOUNT_DELETED',
    'profiles',
    v_user::text,
    jsonb_build_object(
      'email_sha256', encode(sha256(convert_to(coalesce(v_profile.email, ''), 'UTF8')), 'hex'),
      'name_sha256', encode(sha256(convert_to(coalesce(v_profile.name, ''), 'UTF8')), 'hex')
    ),
    null
  );

  delete from auth.users where id = v_user;  -- profiles/admins cascade
end;
$$;
revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
