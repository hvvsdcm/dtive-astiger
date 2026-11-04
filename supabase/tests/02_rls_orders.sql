-- RLS on orders, order items/events, addresses and wishlists.
begin;
select plan(22);

-- fixture (as postgres) --------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'u1@test.local', 'authenticated', 'authenticated',
   '{"name":"유저1","terms_agreed":true,"privacy_agreed":true,"age_confirmed":true}'),
  ('22222222-2222-4222-8222-222222222222', 'u2@test.local', 'authenticated', 'authenticated',
   '{"name":"유저2","terms_agreed":true,"privacy_agreed":true,"age_confirmed":true}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin@test.local', 'authenticated', 'authenticated',
   '{"name":"관리자","terms_agreed":true,"privacy_agreed":true,"age_confirmed":true}');
insert into public.admins (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.products (id, slug, name, price, status) values
  ('f0000000-0000-4000-8000-000000000001', 'test-active', '테스트', 10000, 'active');

insert into public.orders (id, order_no, user_id, subtotal, shipping_fee, total, recipient, phone, postal_code,
  address1, depositor_name, bank_name, bank_account, bank_holder, payment_due_at)
values
  ('0d000000-0000-4000-8000-000000000001', 'T-0001', '11111111-1111-4111-8111-111111111111', 10000, 3000, 13000,
   '유저1', '01011112222', '06236', '서울', '유저1', '은행', '1', '예금주', now() + interval '1 day'),
  ('0d000000-0000-4000-8000-000000000002', 'T-0002', '22222222-2222-4222-8222-222222222222', 10000, 3000, 13000,
   '유저2', '01033334444', '06236', '부산', '유저2', '은행', '1', '예금주', now() + interval '1 day');
insert into public.order_items (order_id, product_id, product_name, variant_label, sku, unit_price, quantity) values
  ('0d000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', '테스트', 'M', 'T-1', 10000, 1),
  ('0d000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', '테스트', 'M', 'T-1', 10000, 1);
insert into public.order_events (order_id, to_status) values
  ('0d000000-0000-4000-8000-000000000001', 'pending_payment'),
  ('0d000000-0000-4000-8000-000000000002', 'pending_payment');
insert into public.addresses (user_id, recipient, phone, postal_code, address1) values
  ('22222222-2222-4222-8222-222222222222', '유저2', '01033334444', '06236', '부산');

-- anon --------------------------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$select * from public.orders$$, '42501', null, 'anon cannot read orders');
select throws_ok($$select * from public.order_items$$, '42501', null, 'anon cannot read order_items');
select throws_ok($$select * from public.wishlist_items$$, '42501', null, 'anon cannot read wishlist_items');
reset role;

-- user 1 ------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select results_eq($$select order_no from public.orders$$, $$values ('T-0001'::text)$$, 'user sees only own orders');
select is((select count(*)::int from public.orders where id = '0d000000-0000-4000-8000-000000000002'), 0, 'other user''s order → 0 rows');
select is((select count(*)::int from public.order_items), 1, 'user sees only own order_items');
select is((select count(*)::int from public.order_events), 1, 'user sees only own order_events');
select is((select count(*)::int from public.addresses), 0, 'user cannot see other users'' addresses');

select throws_ok(
  $$update public.orders set status = 'paid' where id = '0d000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'orders.status is not updatable through the API'
);
select throws_ok(
  $$update public.orders set total = 0 where id = '0d000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'orders amounts are not updatable through the API'
);
update public.orders set admin_note = 'user note' where id = '0d000000-0000-4000-8000-000000000001';
select throws_ok(
  $$delete from public.orders where id = '0d000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'orders cannot be deleted through the API'
);

-- addresses: own rows only, single default
select throws_ok(
  $$insert into public.addresses (user_id, recipient, phone, postal_code, address1)
    values ('22222222-2222-4222-8222-222222222222', 'x', '01011112222', '06236', 'x')$$,
  '42501', null, 'cannot insert an address for another user'
);
insert into public.addresses (id, user_id, recipient, phone, postal_code, address1, is_default) values
  ('ad000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '집', '01011112222', '06236', '서울', true);
insert into public.addresses (id, user_id, recipient, phone, postal_code, address1, is_default) values
  ('ad000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '회사', '01011112222', '04524', '서울', true);
select results_eq(
  $$select id from public.addresses where is_default$$,
  $$values ('ad000000-0000-4000-8000-000000000002'::uuid)$$,
  'new default address clears the previous default'
);
update public.addresses set recipient = '탈취' where user_id = '22222222-2222-4222-8222-222222222222';
delete from public.addresses where user_id = '22222222-2222-4222-8222-222222222222';

-- wishlist
select throws_ok(
  $$insert into public.wishlist_items (user_id, product_id) values ('22222222-2222-4222-8222-222222222222', 'f0000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'cannot add to another user''s wishlist'
);
select lives_ok(
  $$insert into public.wishlist_items (user_id, product_id) values ('11111111-1111-4111-8111-111111111111', 'f0000000-0000-4000-8000-000000000001')$$,
  'can add to own wishlist'
);
reset role;

select is((select admin_note from public.orders where id = '0d000000-0000-4000-8000-000000000001'), '', 'non-admin admin_note update had no effect');
select results_eq(
  $$select recipient from public.addresses where user_id = '22222222-2222-4222-8222-222222222222'$$,
  $$values ('유저2'::text)$$,
  'other user''s address untouched by update/delete'
);

-- admin -------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
select is((select count(*)::int from public.orders where order_no like 'T-%'), 2, 'admin sees all orders');
select lives_ok(
  $$update public.orders set admin_note = '확인 필요', carrier = 'cj', tracking_no = '123' where id = '0d000000-0000-4000-8000-000000000002'$$,
  'admin can edit admin_note / carrier / tracking_no'
);
select throws_ok(
  $$update public.orders set status = 'delivered' where id = '0d000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'even admins change status only through RPCs'
);
select is((select count(*)::int from public.addresses), 0, 'admins do not read customer address books');
reset role;

select is((select admin_note from public.orders where id = '0d000000-0000-4000-8000-000000000002'), '확인 필요', 'admin note saved');

select * from finish();
rollback;
