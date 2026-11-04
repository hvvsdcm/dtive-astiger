-- cancel_my_order and expire_unpaid_orders.
begin;
select plan(17);

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

insert into public.products (id, slug, name, price, status) values
  ('f0000000-0000-4000-8000-000000000001', 'test-active', '테스트', 10000, 'active');
insert into public.product_variants (id, product_id, sku, size, stock) values
  ('e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'T-M', 'M', 10);

create temporary table _orders (name text primary key, id uuid) on commit drop;
grant all on _orders to authenticated;

-- user 1 places three orders (2 units each → stock 10 - 6 = 4)
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into _orders
select n, (public.create_order(
  '[{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":2}]',
  '{"recipient":"유저1","phone":"01011112222","postal_code":"06236","address1":"서울"}', '', '유저1'
) ->> 'order_id')::uuid
from unnest(array['a', 'b', 'c']) n;
reset role;

select is((select stock from public.product_variants where id = 'e0000000-0000-4000-8000-000000000001'), 4, 'three orders reserved 6 units');

-- cancel pending order → cancelled + stock restored --------------------------------------------
set local role authenticated;
select lives_ok(
  $$select public.cancel_my_order((select id from _orders where name = 'a'), '단순 변심')$$,
  'owner can cancel a pending order'
);
reset role;
select results_eq(
  $$select status::text, cancel_reason, cancelled_at is not null from public.orders where id = (select id from _orders where name = 'a')$$,
  $$values ('cancelled'::text, '단순 변심'::text, true)$$,
  'pending order cancelled with reason and timestamp'
);
select is((select stock from public.product_variants where id = 'e0000000-0000-4000-8000-000000000001'), 6, 'cancel restored 2 units');
select is(
  (select count(*)::int from public.order_events where order_id = (select id from _orders where name = 'a') and to_status = 'cancelled'),
  1, 'cancel event recorded'
);

-- cancelling again / other users ----------------------------------------------------------------
set local role authenticated;
select throws_ok(
  $$select public.cancel_my_order((select id from _orders where name = 'a'), null)$$,
  'P0001', 'CANNOT_CANCEL', 'already cancelled → CANNOT_CANCEL'
);
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_ok(
  $$select public.cancel_my_order((select id from _orders where name = 'b'), null)$$,
  'P0001', 'CANNOT_CANCEL', 'another user''s order → CANNOT_CANCEL'
);
reset role;

-- paid order → cancel request only ---------------------------------------------------------------
update public.orders set status = 'paid', paid_at = now() where id = (select id from _orders where name = 'b');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok(
  $$select public.cancel_my_order((select id from _orders where name = 'b'), '')$$,
  'P0001', 'INVALID_INPUT', 'cancel request needs a reason'
);
select lives_ok(
  $$select public.cancel_my_order((select id from _orders where name = 'b'), '사이즈 변경')$$,
  'owner can request cancellation of a paid order'
);
reset role;
select results_eq(
  $$select status::text, cancel_requested_at is not null, cancel_reason from public.orders where id = (select id from _orders where name = 'b')$$,
  $$values ('paid'::text, true, '사이즈 변경'::text)$$,
  'cancel request keeps status paid'
);
select is((select stock from public.product_variants where id = 'e0000000-0000-4000-8000-000000000001'), 6, 'cancel request does not restore stock');

-- delivered order cannot be cancelled
update public.orders set status = 'delivered', cancel_requested_at = null where id = (select id from _orders where name = 'b');
set local role authenticated;
select throws_ok(
  $$select public.cancel_my_order((select id from _orders where name = 'b'), '반품')$$,
  'P0001', 'CANNOT_CANCEL', 'delivered order → CANNOT_CANCEL'
);

-- expire_unpaid_orders ------------------------------------------------------------------------------
select throws_ok($$select public.expire_unpaid_orders()$$, 'P0001', 'FORBIDDEN', 'non-admin cannot run expiry');
reset role;

update public.orders set payment_due_at = now() - interval '1 minute' where id = (select id from _orders where name = 'c');

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","aal":"aal2"}';
select is(public.expire_unpaid_orders(), 1, 'admin run expires the overdue order');
reset role;

select results_eq(
  $$select status::text, cancel_reason from public.orders where id = (select id from _orders where name = 'c')$$,
  $$values ('cancelled'::text, '입금 기한 만료'::text)$$,
  'overdue order cancelled with expiry reason'
);
select is((select stock from public.product_variants where id = 'e0000000-0000-4000-8000-000000000001'), 8, 'expiry restored 2 units');

-- cron path: no request JWT at all
set local request.jwt.claims = '';
select is(public.expire_unpaid_orders(), 0, 'no-JWT (pg_cron) call runs and finds nothing left');

select * from finish();
rollback;
