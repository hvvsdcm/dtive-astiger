-- create_order: server-side pricing, stock, shipping fee and error codes.
begin;
select plan(29);

-- fixture (as postgres) --------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'u1@test.local', 'authenticated', 'authenticated',
   '{"name":"유저1","terms_agreed":true,"privacy_agreed":true,"age_confirmed":true}');

insert into public.site_settings (id, shipping_fee, free_shipping_threshold, bank_name, bank_account, bank_holder, payment_due_hours)
values (1, 3000, 100000, '테스트은행', '123-456-789', '테스트', 48)
on conflict (id) do update
  set shipping_fee = excluded.shipping_fee, free_shipping_threshold = excluded.free_shipping_threshold,
      bank_name = excluded.bank_name, bank_account = excluded.bank_account,
      bank_holder = excluded.bank_holder, payment_due_hours = excluded.payment_due_hours;

insert into public.products (id, slug, name, price, status) values
  ('f0000000-0000-4000-8000-000000000001', 'test-active', '테스트 셔츠', 40000, 'active'),
  ('f0000000-0000-4000-8000-000000000002', 'test-draft', '테스트 초안', 10000, 'draft');
insert into public.product_variants (id, product_id, sku, color, size, stock, price_delta, is_active) values
  ('e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'T-ACT-BLK-M', 'Black', 'M', 5, 0, true),
  ('e0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'T-ACT-WHT-L', 'White', 'L', 1, 5000, true),
  ('e0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000002', 'T-DRF-BLK-M', 'Black', 'M', 5, 0, true),
  ('e0000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000001', 'T-ACT-BLK-S', 'Black', 'S', 5, 0, false);
insert into public.product_images (product_id, storage_path, color, sort) values
  ('f0000000-0000-4000-8000-000000000001', 'products/f0000000-0000-4000-8000-000000000001/a.webp', 'Black', 0),
  ('f0000000-0000-4000-8000-000000000001', 'products/f0000000-0000-4000-8000-000000000001/b.webp', 'White', 1);

create temporary table _result (r jsonb) on commit drop;
grant all on _result to anon, authenticated;

-- anon cannot call it at all ---------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$select public.create_order('[]', '{}', '', '')$$,
  '42501', null, 'anon has no EXECUTE on create_order'
);
reset role;

-- authenticated without a user id ----------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$select public.create_order('[{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":1}]',
    '{"recipient":"홍길동","phone":"01012345678","postal_code":"06236","address1":"서울시 강남구 테헤란로 1"}', '', '홍길동')$$,
  'P0001', 'AUTH_REQUIRED', 'no auth.uid() → AUTH_REQUIRED'
);

-- as user 1 ---------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- input validation
select throws_ok(
  $$select public.create_order('[]', '{"recipient":"a","phone":"01012345678","postal_code":"06236","address1":"x"}', '', 'a')$$,
  'P0001', 'INVALID_INPUT', 'empty item list'
);
select throws_ok(
  $$select public.create_order('[{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":11}]',
    '{"recipient":"a","phone":"01012345678","postal_code":"06236","address1":"x"}', '', 'a')$$,
  'P0001', 'INVALID_INPUT', 'quantity above 10'
);
select throws_ok(
  $$select public.create_order('[{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":1},{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":1}]',
    '{"recipient":"a","phone":"01012345678","postal_code":"06236","address1":"x"}', '', 'a')$$,
  'P0001', 'INVALID_INPUT', 'duplicate variant'
);
select throws_ok(
  $$select public.create_order('[{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":1}]',
    '{"recipient":"a","phone":"02-123-4567","postal_code":"06236","address1":"x"}', '', 'a')$$,
  'P0001', 'INVALID_INPUT', 'invalid phone'
);
select throws_ok(
  $$select public.create_order('[{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":1}]',
    '{"recipient":"a","phone":"01012345678","postal_code":"06236","address1":"x"}', '', '')$$,
  'P0001', 'INVALID_INPUT', 'empty depositor name'
);

-- availability
select throws_ok(
  $$select public.create_order('[{"variant_id":"e0000000-0000-4000-8000-000000000003","quantity":1}]',
    '{"recipient":"a","phone":"01012345678","postal_code":"06236","address1":"x"}', '', 'a')$$,
  'P0001', 'ITEM_UNAVAILABLE', 'draft product → ITEM_UNAVAILABLE'
);
select throws_ok(
  $$select public.create_order('[{"variant_id":"e0000000-0000-4000-8000-000000000004","quantity":1}]',
    '{"recipient":"a","phone":"01012345678","postal_code":"06236","address1":"x"}', '', 'a')$$,
  'P0001', 'ITEM_UNAVAILABLE', 'inactive variant → ITEM_UNAVAILABLE'
);
select throws_ok(
  $$select public.create_order('[{"variant_id":"e0000000-0000-4000-8000-0000000000ff","quantity":1}]',
    '{"recipient":"a","phone":"01012345678","postal_code":"06236","address1":"x"}', '', 'a')$$,
  'P0001', 'ITEM_UNAVAILABLE', 'unknown variant → ITEM_UNAVAILABLE'
);
select throws_ok(
  $$select public.create_order('[{"variant_id":"e0000000-0000-4000-8000-000000000002","quantity":2}]',
    '{"recipient":"a","phone":"01012345678","postal_code":"06236","address1":"x"}', '', 'a')$$,
  'P0001', 'OUT_OF_STOCK', 'quantity above stock → OUT_OF_STOCK'
);

-- success below the free-shipping threshold; client-sent prices are ignored
insert into _result
select public.create_order(
  '[{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":1,"unit_price":1,"price":1},
    {"variant_id":"e0000000-0000-4000-8000-000000000002","quantity":1,"unit_price":1}]',
  '{"recipient":"홍길동","phone":"01012345678","postal_code":"06236","address1":"서울시 강남구 테헤란로 1","address2":"101호","total":0}',
  '문 앞에 놓아 주세요', '홍길동'
);
reset role;

select is((select (r ->> 'total')::int from _result), 40000 + 45000 + 3000, 'total = server prices + shipping fee (client prices ignored)');
select matches((select r ->> 'order_no' from _result), '^[0-9]{8}-[0-9A-HJKMNP-TV-Z]{6}$', 'order_no format YYYYMMDD-XXXXXX');
select is((select r -> 'bank' ->> 'bank_account' from _result), '123-456-789', 'bank snapshot returned');

select results_eq(
  $$select subtotal, shipping_fee, total, status::text, user_id from public.orders where id = (select (r ->> 'order_id')::uuid from _result)$$,
  $$values (85000, 3000, 88000, 'pending_payment', '11111111-1111-4111-8111-111111111111'::uuid)$$,
  'order row stores server-computed amounts'
);
select ok(
  (select payment_due_at between now() + interval '47 hours 59 minutes' and now() + interval '48 hours 1 minute'
     from public.orders where id = (select (r ->> 'order_id')::uuid from _result)),
  'payment_due_at = now + payment_due_hours'
);
select is((select stock from public.product_variants where id = 'e0000000-0000-4000-8000-000000000001'), 4, 'stock decremented (5 - 1)');
select is((select stock from public.product_variants where id = 'e0000000-0000-4000-8000-000000000002'), 0, 'stock decremented (1 - 1)');
select results_eq(
  $$select sku, unit_price, quantity, line_total, variant_label, image_path
      from public.order_items where order_id = (select (r ->> 'order_id')::uuid from _result) order by sku$$,
  $$values ('T-ACT-BLK-M', 40000, 1, 40000, 'Black / M', 'products/f0000000-0000-4000-8000-000000000001/a.webp'),
           ('T-ACT-WHT-L', 45000, 1, 45000, 'White / L', 'products/f0000000-0000-4000-8000-000000000001/b.webp')$$,
  'order_items snapshot prices, labels and colour-matched image'
);
select results_eq(
  $$select from_status::text, to_status::text, actor_id from public.order_events where order_id = (select (r ->> 'order_id')::uuid from _result)$$,
  $$values (null::text, 'pending_payment'::text, '11111111-1111-4111-8111-111111111111'::uuid)$$,
  'creation event recorded'
);

-- free shipping at/above the threshold
update public.product_variants set stock = 10 where id = 'e0000000-0000-4000-8000-000000000001';
delete from _result;
set local role authenticated;
insert into _result
select public.create_order(
  '[{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":3}]',
  '{"recipient":"홍길동","phone":"01012345678","postal_code":"06236","address1":"서울시"}', null, '홍길동'
);
reset role;
select results_eq(
  $$select subtotal, shipping_fee, total from public.orders where id = (select (r ->> 'order_id')::uuid from _result)$$,
  $$values (120000, 0, 120000)$$,
  'subtotal >= free_shipping_threshold → shipping 0'
);

-- no threshold configured → always charged
update public.site_settings set free_shipping_threshold = null where id = 1;
delete from _result;
set local role authenticated;
insert into _result
select public.create_order(
  '[{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":3}]',
  '{"recipient":"홍길동","phone":"01012345678","postal_code":"06236","address1":"서울시"}', '', '홍길동'
);
reset role;
select is((select shipping_fee from public.orders where id = (select (r ->> 'order_id')::uuid from _result)), 3000, 'threshold null → shipping fee charged');

-- user 1 now has 3 pending orders; mark them paid (stock unchanged) to stay under the 0009 limit
update public.orders set status = 'paid' where user_id = '11111111-1111-4111-8111-111111111111';
-- sold out after the orders above (10 - 3 - 3 = 4 left)
set local role authenticated;
select throws_ok(
  $$select public.create_order('[{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":5}]',
    '{"recipient":"a","phone":"01012345678","postal_code":"06236","address1":"x"}', '', 'a')$$,
  'P0001', 'OUT_OF_STOCK', 'remaining stock enforced'
);
reset role;
select is((select stock from public.product_variants where id = 'e0000000-0000-4000-8000-000000000001'), 4, 'failed order leaves stock untouched');

-- bank account missing
update public.site_settings set bank_account = '' where id = 1;
set local role authenticated;
select throws_ok(
  $$select public.create_order('[{"variant_id":"e0000000-0000-4000-8000-000000000001","quantity":1}]',
    '{"recipient":"a","phone":"01012345678","postal_code":"06236","address1":"x"}', '', 'a')$$,
  'P0001', 'BANK_NOT_CONFIGURED', 'empty bank account → BANK_NOT_CONFIGURED'
);

-- direct writes are impossible
select throws_ok(
  $$insert into public.orders (order_no, user_id, subtotal, shipping_fee, total, recipient, phone, postal_code, address1,
      depositor_name, bank_name, bank_account, bank_holder, payment_due_at)
    values ('X', '11111111-1111-4111-8111-111111111111', 0, 0, 0, 'a', '01012345678', '06236', 'x', 'a', 'b', 'c', 'd', now())$$,
  '42501', null, 'orders cannot be inserted through the API'
);
select throws_ok(
  $$insert into public.order_items (order_id, product_name, variant_label, sku, unit_price, quantity)
    select id, 'x', 'x', 'x', 0, 1 from public.orders limit 1$$,
  '42501', null, 'order_items cannot be inserted through the API'
);
select throws_ok(
  $$update public.product_variants set stock = 100 where id = 'e0000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'customers cannot write product_variants.stock (no column privilege)'
);
reset role;
select is((select stock from public.product_variants where id = 'e0000000-0000-4000-8000-000000000001'), 4,
  'customers cannot write product_variants');

select * from finish();
rollback;
