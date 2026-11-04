-- Storage listing, home-section link rules, and admin stock writes (admin_set_stock).
begin;
select plan(29);

-- fixture (as postgres) --------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'u1@test.local', 'authenticated', 'authenticated',
   '{"name":"유저1","terms_agreed":true,"privacy_agreed":true,"age_confirmed":true}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin@test.local', 'authenticated', 'authenticated',
   '{"name":"관리자","terms_agreed":true,"privacy_agreed":true,"age_confirmed":true}');
insert into public.admins (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.site_settings (id, bank_name, bank_account, bank_holder)
values (1, '테스트은행', '123-456-789', '테스트')
on conflict (id) do update set bank_account = excluded.bank_account, payment_due_hours = 48;

insert into public.products (id, slug, name, price, status) values
  ('f0000000-0000-4000-8000-000000000001', 'test-a', '테스트A', 10000, 'active'),
  ('f0000000-0000-4000-8000-000000000002', 'test-b', '테스트B', 10000, 'active');
insert into public.product_variants (id, product_id, sku, size, stock) values
  ('e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'TA-M', 'M', 10),
  ('e0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'TA-L', 'L', 10),
  ('e0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000002', 'TB-M', 'M', 10);

insert into storage.objects (bucket_id, name) values
  ('products', 'f0000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000a1.webp');

-- Storage: only admins can list objects -----------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((select count(*) from storage.objects where bucket_id in ('products', 'banners')), 0::bigint,
  'anon cannot list storage objects');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is((select count(*) from storage.objects where bucket_id in ('products', 'banners')), 0::bigint,
  'customers cannot list storage objects');

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
select ok((select count(*) from storage.objects where bucket_id = 'products'
            and name like 'f0000000-0000-4000-8000-000000000001/%') = 1,
  'admins can list storage objects');
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('banners', 'f0000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000b1_m.webp')$$,
  'admins can still upload');
-- The Storage API sets this flag for its own deletes; RLS still decides which rows are visible.
set local storage.allow_delete_query = 'true';
select lives_ok(
  $$delete from storage.objects where bucket_id = 'banners'
     and name = 'f0000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000b1_m.webp'$$,
  'admins can still delete');
select is((select count(*) from storage.objects where bucket_id = 'banners'
            and name like 'f0000000-0000-4000-8000-000000000001/%'), 0::bigint,
  'the object is gone');

-- Home-section links ------------------------------------------------------------------------------
select lives_ok(
  $$insert into public.home_sections (id, kind, link_href, items) values
    ('5e000000-0000-4000-8000-000000000001', 'lookbook', '/lookbook?season=aw26',
     '[{"image_path":"banners/x/1.webp","caption":"a","href":"/shop/women"},{"image_path":"banners/x/2.webp","caption":"b","href":""},{"image_path":"banners/x/3.webp","caption":"c"}]')$$,
  'internal paths, empty and missing hrefs are accepted');
select lives_ok(
  $$update public.home_sections set link_href = '/' where id = '5e000000-0000-4000-8000-000000000001'$$,
  '"/" is accepted');
select throws_ok(
  $$update public.home_sections set link_href = '/\evil.example.com' where id = '5e000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'link_href "/\host" is rejected');
select throws_ok(
  $$update public.home_sections set link_href = E'/\t/evil.example.com' where id = '5e000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'link_href with a tab is rejected');
select throws_ok(
  $$update public.home_sections set link_href = 'https://evil.example.com' where id = '5e000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'link_href with another origin is rejected');
select throws_ok(
  $$update public.home_sections set link_href = '//evil.example.com' where id = '5e000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'link_href "//host" is rejected');
select throws_ok(
  $$update public.home_sections set items = '[{"caption":"a","href":"/\\evil.example.com"}]'
     where id = '5e000000-0000-4000-8000-000000000001'$$,
  'P0001', 'INVALID_INPUT', 'items href "/\host" is rejected');
select throws_ok(
  $$update public.home_sections set items = '[{"caption":"a","href":"javascript:alert(1)"}]'
     where id = '5e000000-0000-4000-8000-000000000001'$$,
  'P0001', 'INVALID_INPUT', 'items href with a scheme is rejected');
select throws_ok(
  $$insert into public.home_sections (kind, items) values ('lookbook', '[{"caption":"a","href":5}]')$$,
  'P0001', 'INVALID_INPUT', 'items href must be a string');

-- Stock: no direct writes to existing rows ---------------------------------------------------------
select throws_ok(
  $$update public.product_variants set stock = 99 where id = 'e0000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'admins cannot overwrite stock directly');
select lives_ok(
  $$insert into public.product_variants (id, product_id, sku, color, size, price_delta, sort, is_active)
    values ('e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'TA-M2', '', 'M', 0, 3, true)
    on conflict (id) do update set sku = excluded.sku, sort = excluded.sort$$,
  'the editor upsert without stock still works');
select lives_ok(
  $$insert into public.product_variants (id, product_id, sku, size, stock)
    values ('e0000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000001', 'TA-S', 'S', 7)$$,
  'new variants are inserted with their stock');

-- admin_set_stock --------------------------------------------------------------------------------
select lives_ok(
  $$select public.admin_set_stock('f0000000-0000-4000-8000-000000000001',
      array['e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002']::uuid[],
      array[10, 10], array[12, 10])$$,
  'admin_set_stock with the read values');
select is((select stock from public.product_variants where id = 'e0000000-0000-4000-8000-000000000001'), 12,
  'stock set');

-- a customer orders one of variant 2 while the editor still shows 10
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select lives_ok(
  $$select public.create_order(
    '[{"variant_id":"e0000000-0000-4000-8000-000000000002","quantity":1}]',
    '{"recipient":"유저1","phone":"01011112222","postal_code":"06236","address1":"서울"}', '', '유저1')$$,
  'customer order while the editor is open');
select throws_ok(
  $$select public.admin_set_stock('f0000000-0000-4000-8000-000000000001',
      array['e0000000-0000-4000-8000-000000000001']::uuid[], array[12], array[1])$$,
  'P0001', 'FORBIDDEN', 'non-admin admin_set_stock → FORBIDDEN');

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
select throws_ok(
  $$select public.admin_set_stock('f0000000-0000-4000-8000-000000000001',
      array['e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002']::uuid[],
      array[12, 10], array[20, 20])$$,
  'P0001', 'STOCK_CHANGED', 'stale expected value → STOCK_CHANGED');
select results_eq(
  $$select stock from public.product_variants
     where id in ('e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002') order by id$$,
  $$values (12), (9)$$,
  'STOCK_CHANGED writes nothing (order deduction kept)');
select throws_ok(
  $$select public.admin_set_stock('f0000000-0000-4000-8000-000000000001',
      array['e0000000-0000-4000-8000-000000000003']::uuid[], array[10], array[1])$$,
  'P0001', 'INVALID_INPUT', 'variant of another product → INVALID_INPUT');
select throws_ok(
  $$select public.admin_set_stock('f0000000-0000-4000-8000-000000000001',
      array['e0000000-0000-4000-8000-000000000001']::uuid[], array[12, 1], array[1])$$,
  'P0001', 'INVALID_INPUT', 'array length mismatch → INVALID_INPUT');
select throws_ok(
  $$select public.admin_set_stock('f0000000-0000-4000-8000-000000000001',
      array['e0000000-0000-4000-8000-000000000001']::uuid[], array[12], array[-1])$$,
  'P0001', 'INVALID_INPUT', 'negative stock → INVALID_INPUT');

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$select public.admin_set_stock('f0000000-0000-4000-8000-000000000001',
      array['e0000000-0000-4000-8000-000000000001']::uuid[], array[12], array[1])$$,
  '42501', null, 'anon cannot execute admin_set_stock');

reset role;
select is((select count(*)::integer from public.audit_logs
            where table_name = 'product_variants' and row_id = 'e0000000-0000-4000-8000-000000000001'
              and actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and action = 'UPDATE'), 2,
  'stock changes are audited with the admin as actor');

select * from finish();
rollback;
