-- 0009: admin-only columns, admin_get_order, create_order limits, marketing consent stamp,
-- no personal data in audit_logs.
begin;
select plan(30);

-- fixture (as postgres) --------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'u1@test.local', 'authenticated', 'authenticated',
   '{"name":"유저1","terms_agreed":true,"privacy_agreed":true,"age_confirmed":true}'),
  ('22222222-2222-4222-8222-222222222222', 'u2@test.local', 'authenticated', 'authenticated',
   '{"name":"유저2","terms_agreed":true,"privacy_agreed":true,"age_confirmed":true}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin@test.local', 'authenticated', 'authenticated',
   '{"name":"관리자","terms_agreed":true,"privacy_agreed":true,"age_confirmed":true}');
insert into public.admins (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.site_settings (id, bank_name, bank_account, bank_holder)
values (1, '테스트은행', '123-456-789', '테스트')
on conflict (id) do update set bank_account = excluded.bank_account, free_shipping_threshold = 100000, payment_due_hours = 48;
update public.site_settings set updated_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' where id = 1;

insert into public.products (id, slug, name, price, status) values
  ('f0000000-0000-4000-8000-000000000001', 'test-active', '테스트', 10000, 'active');
insert into public.product_variants (id, product_id, sku, size, stock) values
  ('e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'T-M', 'M', 50);

create temporary table _orders (name text primary key, id uuid) on commit drop;
grant all on _orders to authenticated;

-- user 1 places three orders (the pending limit)
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into _orders
select n, (public.create_order(
  '[{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":1}]',
  '{"recipient":"유저1","phone":"01011112222","postal_code":"06236","address1":"서울 비밀로 1"}', '문 앞', '입금자1'
) ->> 'order_id')::uuid
from unnest(array['a', 'b', 'c']) n;
reset role;

-- admin memo and an admin status note (refund account) on order a
update public.orders set admin_note = '내부: 블랙리스트 의심' where id = (select id from _orders where name = 'a');
update public.orders set status = 'paid', paid_at = now() where id = (select id from _orders where name = 'a');
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
do $$ begin perform public.admin_update_order_status((select id from _orders where name = 'a'), 'cancelled', '환불 국민 123-456 유저1'); end $$;
reset role;

-- M1: customer cannot read admin-only columns --------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok($$select admin_note from public.orders$$, '42501', null, 'customer cannot read orders.admin_note');
select throws_ok($$select * from public.orders$$, '42501', null, 'customer select * on orders is rejected (admin_note)');
select throws_ok($$select note from public.order_events$$, '42501', null, 'customer cannot read order_events.note');
select throws_ok($$select actor_id from public.order_events$$, '42501', null, 'customer cannot read order_events.actor_id');
select results_eq(
  $$select status::text, cancel_reason from public.orders where id = (select id from _orders where name = 'a')$$,
  $$values ('cancelled'::text, '관리자 취소'::text)$$,
  'customer reads own order; the admin cancel note is not copied into cancel_reason'
);
select results_eq(
  $$select from_status::text, to_status::text from public.order_events
     where order_id = (select id from _orders where name = 'a') order by created_at, id$$,
  $$values (null::text, 'pending_payment'::text), ('paid'::text, 'cancelled'::text)$$,
  'customer reads own event statuses'
);
select throws_ok(
  $$select public.admin_get_order((select id from _orders where name = 'a'))$$,
  'P0001', 'FORBIDDEN', 'customer cannot call admin_get_order'
);
reset role;

-- customer cancel request reason stays visible to the customer
update public.orders set status = 'paid', paid_at = now() where id = (select id from _orders where name = 'b');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
do $$ begin perform public.cancel_my_order((select id from _orders where name = 'b'), '사이즈 변경'); end $$;
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
do $$ begin perform public.admin_update_order_status((select id from _orders where name = 'b'), 'cancelled', '환불 신한 999'); end $$;
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(
  (select cancel_reason from public.orders where id = (select id from _orders where name = 'b')),
  '사이즈 변경', 'customer still sees their own cancel request reason after the admin cancels'
);
reset role;

-- admin reads everything through admin_get_order -------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
select throws_ok($$select admin_note from public.orders$$, '42501', null, 'admins also read admin_note only through the RPC');
select is(
  public.admin_get_order((select id from _orders where name = 'a')) ->> 'admin_note',
  '내부: 블랙리스트 의심', 'admin_get_order returns admin_note'
);
select results_eq(
  $$select e ->> 'note', (e ->> 'actor_id')::uuid
      from jsonb_array_elements(public.admin_get_order((select id from _orders where name = 'a')) -> 'events') e
     where e ->> 'to_status' = 'cancelled'$$,
  $$values ('환불 국민 123-456 유저1'::text, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid)$$,
  'admin_get_order returns event note and actor_id'
);
select is(
  jsonb_array_length(public.admin_get_order((select id from _orders where name = 'a')) -> 'items'),
  1, 'admin_get_order returns the lines'
);
select is(
  public.admin_get_order((select id from _orders where name = 'a')) -> 'customer' ->> 'email',
  'u1@test.local', 'admin_get_order returns the orderer'
);
select is(public.admin_get_order('00000000-0000-4000-8000-000000000000'), null, 'admin_get_order → null for unknown id');
select lives_ok(
  $$update public.orders set admin_note = '확인 완료' where id = (select id from _orders where name = 'c')$$,
  'admin can still write admin_note'
);
reset role;
select is((select admin_note from public.orders where id = (select id from _orders where name = 'c')), '확인 완료', 'admin_note saved');

-- L9: site_settings.updated_by hidden ------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$select updated_by from public.site_settings$$, '42501', null, 'anon cannot read site_settings.updated_by');
select is((select shipping_fee from public.site_settings where id = 1), 3000, 'anon still reads the public settings');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_ok($$select updated_by from public.site_settings$$, '42501', null, 'members cannot read site_settings.updated_by');
reset role;

-- M2: per-customer limits ------------------------------------------------------------------------
-- user 2: three pending orders, the fourth is refused
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
insert into _orders
select n, (public.create_order(
  '[{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":1}]',
  '{"recipient":"유저2","phone":"01022223333","postal_code":"06236","address1":"서울"}', '', '유저2'
) ->> 'order_id')::uuid
from unnest(array['p1', 'p2', 'p3']) n;
select throws_ok(
  $$select public.create_order('[{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":1}]',
    '{"recipient":"유저2","phone":"01022223333","postal_code":"06236","address1":"서울"}', '', '유저2')$$,
  'P0001', 'TOO_MANY_PENDING', '4th pending order → TOO_MANY_PENDING'
);
select is(
  (select count(*)::int from public.orders where user_id = '22222222-2222-4222-8222-222222222222'),
  3, 'refused order left nothing behind'
);
-- cancelling one frees a slot
do $$ begin perform public.cancel_my_order((select id from _orders where name = 'p1'), ''); end $$;
select lives_ok(
  $$select public.create_order('[{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":1}]',
    '{"recipient":"유저2","phone":"01022223333","postal_code":"06236","address1":"서울"}', '', '유저2')$$,
  'a cancelled order frees a pending slot'
);
reset role;

-- 10 orders within the hour (4 above + 6 cancelled) → the 11th is refused even with a free slot
insert into public.orders (order_no, user_id, status, subtotal, shipping_fee, total, recipient, phone, postal_code,
                           address1, depositor_name, bank_name, bank_account, bank_holder, payment_due_at)
select 'LIM-' || g, '22222222-2222-4222-8222-222222222222', 'cancelled', 0, 0, 0, '유저2', '01022223333', '06236',
       '서울', '유저2', '은행', '1', '예금주', now() + interval '1 day'
  from generate_series(1, 6) g;
update public.orders set status = 'cancelled' where id = (select id from _orders where name = 'p2');
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_ok(
  $$select public.create_order('[{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":1}]',
    '{"recipient":"유저2","phone":"01022223333","postal_code":"06236","address1":"서울"}', '', '유저2')$$,
  'P0001', 'TOO_MANY_ORDERS', '11th order within an hour → TOO_MANY_ORDERS'
);
reset role;
update public.orders set created_at = now() - interval '2 hours' where order_no like 'LIM-%';
set local role authenticated;
select lives_ok(
  $$select public.create_order('[{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":1}]',
    '{"recipient":"유저2","phone":"01022223333","postal_code":"06236","address1":"서울"}', '', '유저2')$$,
  'orders older than an hour do not count'
);
reset role;

-- L8: marketing consent time is set by the server ------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
update public.profiles set marketing_agreed_at = '2000-01-01T00:00:00Z' where id = '11111111-1111-4111-8111-111111111111';
select is((select marketing_agreed_at from public.profiles where id = '11111111-1111-4111-8111-111111111111'), now(), 'client time ignored: consent stamped now()');
update public.profiles set marketing_agreed_at = '2099-01-01T00:00:00Z' where id = '11111111-1111-4111-8111-111111111111';
select is((select marketing_agreed_at from public.profiles where id = '11111111-1111-4111-8111-111111111111'), now(), 'existing consent time cannot be rewritten');
update public.profiles set marketing_agreed_at = null where id = '11111111-1111-4111-8111-111111111111';
select is((select marketing_agreed_at from public.profiles where id = '11111111-1111-4111-8111-111111111111'), null, 'withdrawal clears the consent');
reset role;

-- L11: no personal data in order audit rows ------------------------------------------------------
select is(
  (select count(*)::int from public.audit_logs
    where table_name = 'orders'
      and (coalesce(before, '{}') ?| array['recipient', 'phone', 'postal_code', 'address1', 'address2', 'memo', 'depositor_name', 'cancel_reason', 'admin_note']
        or coalesce(after, '{}') ?| array['recipient', 'phone', 'postal_code', 'address1', 'address2', 'memo', 'depositor_name', 'cancel_reason', 'admin_note'])),
  0, 'orders audit rows hold no recipient/contact/address/memo/depositor/admin note'
);
select is(
  (select count(*)::int from public.audit_logs where table_name = 'orders' and row_id = (select id::text from _orders where name = 'a') and action = 'INSERT'),
  1, 'order creation is still audited'
);
select ok(
  exists (
    select 1 from public.audit_logs
     where table_name = 'orders' and row_id = (select id::text from _orders where name = 'c')
       and after -> 'redacted_changed' = '["admin_note"]'::jsonb
  ),
  'a memo-only edit is audited by field name only'
);

select * from finish();
rollback;
