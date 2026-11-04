-- Admin RPCs: authorization, status transition table, stock restore-once, audit logging.
begin;
select plan(30);

-- fixture (as postgres) --------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'u1@test.local', 'authenticated', 'authenticated',
   '{"name":"유저1","terms_agreed":true,"privacy_agreed":true,"age_confirmed":true}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin@test.local', 'authenticated', 'authenticated',
   '{"name":"관리자","terms_agreed":true,"privacy_agreed":true,"age_confirmed":true}');
insert into public.admins (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.site_settings (id, bank_name, bank_account, bank_holder)
values (1, '테스트은행', '123-456-789', '테스트')
on conflict (id) do update set bank_account = excluded.bank_account, free_shipping_threshold = 100000, payment_due_hours = 48;

insert into public.products (id, slug, name, price, status) values
  ('f0000000-0000-4000-8000-000000000001', 'test-active', '테스트', 10000, 'active');
insert into public.product_variants (id, product_id, sku, size, stock) values
  ('e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'T-M', 'M', 10);
insert into public.product_images (id, product_id, storage_path, sort) values
  ('1a000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'products/x/1.webp', 0),
  ('1a000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'products/x/2.webp', 1);

create temporary table _orders (name text primary key, id uuid) on commit drop;
grant all on _orders to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into _orders
select n, (public.create_order(
  '[{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":2}]',
  '{"recipient":"유저1","phone":"01011112222","postal_code":"06236","address1":"서울"}', '', '유저1'
) ->> 'order_id')::uuid
from unnest(array['ship', 'refund', 'pending']) n;

-- non-admin: every admin RPC is FORBIDDEN -------------------------------------------------------
select throws_ok(
  $$select public.admin_update_order_status((select id from _orders where name = 'ship'), 'paid', '')$$,
  'P0001', 'FORBIDDEN', 'non-admin admin_update_order_status → FORBIDDEN'
);
select throws_ok(
  $$select public.admin_set_tracking((select id from _orders where name = 'ship'), 'cj', '123')$$,
  'P0001', 'FORBIDDEN', 'non-admin admin_set_tracking → FORBIDDEN'
);
select throws_ok(
  $$select public.reorder_product_images('f0000000-0000-4000-8000-000000000001', array['1a000000-0000-4000-8000-000000000002', '1a000000-0000-4000-8000-000000000001']::uuid[])$$,
  'P0001', 'FORBIDDEN', 'non-admin reorder_product_images → FORBIDDEN'
);
select throws_ok($$select public.admin_dashboard_stats()$$, 'P0001', 'FORBIDDEN', 'non-admin admin_dashboard_stats → FORBIDDEN');
reset role;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$select public.admin_update_order_status((select id from _orders where name = 'ship'), 'paid', '')$$,
  '42501', null, 'anon has no EXECUTE on admin functions'
);
reset role;

-- admin ------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","aal":"aal2"}';

-- happy path: pending → paid → preparing → shipped → delivered
select throws_ok(
  $$select public.admin_update_order_status((select id from _orders where name = 'ship'), 'shipped', '')$$,
  'P0001', 'INVALID_TRANSITION', 'pending_payment → shipped is not allowed'
);
select lives_ok($$select public.admin_update_order_status((select id from _orders where name = 'ship'), 'paid', '입금 확인')$$, 'pending_payment → paid');
select throws_ok(
  $$select public.admin_update_order_status((select id from _orders where name = 'ship'), 'refunded', '')$$,
  'P0001', 'INVALID_TRANSITION', 'paid → refunded is not allowed'
);
select lives_ok($$select public.admin_update_order_status((select id from _orders where name = 'ship'), 'preparing', '')$$, 'paid → preparing');
select throws_ok(
  $$select public.admin_update_order_status((select id from _orders where name = 'ship'), 'delivered', '')$$,
  'P0001', 'INVALID_TRANSITION', 'preparing → delivered is not allowed'
);
select throws_ok(
  $$select public.admin_update_order_status((select id from _orders where name = 'ship'), 'shipped', '')$$,
  'P0001', 'INVALID_INPUT', '→ shipped without tracking info is rejected'
);
select throws_ok(
  $$select public.admin_set_tracking((select id from _orders where name = 'ship'), 'cj', '12 34')$$,
  'P0001', 'INVALID_INPUT', 'malformed tracking number rejected'
);
select lives_ok($$select public.admin_set_tracking((select id from _orders where name = 'ship'), 'cj', '123456789012')$$, 'admin_set_tracking: preparing → shipped');
select lives_ok($$select public.admin_set_tracking((select id from _orders where name = 'ship'), 'lotte', '999')$$, 'admin_set_tracking on shipped edits tracking only');
select lives_ok($$select public.admin_update_order_status((select id from _orders where name = 'ship'), 'delivered', '')$$, 'shipped → delivered');
select throws_ok(
  $$select public.admin_update_order_status((select id from _orders where name = 'ship'), 'cancelled', '환불')$$,
  'P0001', 'INVALID_TRANSITION', 'delivered → cancelled is not allowed'
);
reset role;

select results_eq(
  $$select status::text, carrier, tracking_no, paid_at is not null, shipped_at is not null, delivered_at is not null
      from public.orders where id = (select id from _orders where name = 'ship')$$,
  $$values ('delivered'::text, 'lotte'::text, '999'::text, true, true, true)$$,
  'timestamps and tracking set along the way'
);
select is(
  (select count(*)::int from public.order_events where order_id = (select id from _orders where name = 'ship')),
  6, 'every step recorded as an order event'
);

-- paid → cancelled (note required, stock restored once) → refunded (no second restore)
set local role authenticated;
select lives_ok($$select public.admin_update_order_status((select id from _orders where name = 'refund'), 'paid', '')$$, 'refund order paid');
select throws_ok(
  $$select public.admin_update_order_status((select id from _orders where name = 'refund'), 'cancelled', '  ')$$,
  'P0001', 'INVALID_INPUT', 'cancelling a paid order requires a note'
);
select lives_ok(
  $$select public.admin_update_order_status((select id from _orders where name = 'refund'), 'cancelled', '환불 계좌 국민 123, 13000원')$$,
  'paid → cancelled with note'
);
reset role;
select is((select stock from public.product_variants where id = 'e0000000-0000-4000-8000-000000000001'), 6, 'paid cancel restored stock (10 - 6 + 2)');
set local role authenticated;
select lives_ok($$select public.admin_update_order_status((select id from _orders where name = 'refund'), 'refunded', '이체 완료')$$, 'cancelled(paid) → refunded');
reset role;
select is((select stock from public.product_variants where id = 'e0000000-0000-4000-8000-000000000001'), 6, 'refund does not restore stock again');

-- cancelled without payment cannot be refunded
set local role authenticated;
select lives_ok($$select public.admin_update_order_status((select id from _orders where name = 'pending'), 'cancelled', '')$$, 'pending → cancelled by admin');
select throws_ok(
  $$select public.admin_update_order_status((select id from _orders where name = 'pending'), 'refunded', '')$$,
  'P0001', 'INVALID_TRANSITION', 'cancelled (never paid) → refunded is not allowed'
);

-- image reorder, dashboard, audit trail
select lives_ok(
  $$select public.reorder_product_images('f0000000-0000-4000-8000-000000000001', array['1a000000-0000-4000-8000-000000000002', '1a000000-0000-4000-8000-000000000001']::uuid[])$$,
  'admin can reorder images'
);
select ok(
  (select public.admin_dashboard_stats() ?& array['counts', 'today_orders', 'revenue_30d', 'low_stock', 'expired_pending']),
  'dashboard stats has every key'
);
update public.products set price = 11000 where id = 'f0000000-0000-4000-8000-000000000001';
reset role;

select results_eq(
  $$select id from public.product_images where product_id = 'f0000000-0000-4000-8000-000000000001' order by sort$$,
  $$values ('1a000000-0000-4000-8000-000000000002'::uuid), ('1a000000-0000-4000-8000-000000000001'::uuid)$$,
  'images sorted in the given order'
);
select is(
  (select count(*)::int from public.audit_logs
    where table_name = 'products' and action = 'UPDATE' and row_id = 'f0000000-0000-4000-8000-000000000001'
      and actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and (after ->> 'price')::int = 11000),
  1, 'admin product update written to audit_logs with actor'
);

select * from finish();
rollback;
