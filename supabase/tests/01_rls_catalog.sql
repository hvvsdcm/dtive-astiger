-- RLS on catalog, content, profiles, admins, audit logs and storage.
begin;
select plan(33);

-- fixture (as postgres) --------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'u1@test.local', 'authenticated', 'authenticated',
   '{"name":"유저1","terms_agreed":true,"privacy_agreed":true,"age_confirmed":true}'),
  ('22222222-2222-4222-8222-222222222222', 'u2@test.local', 'authenticated', 'authenticated',
   '{"name":"유저2","terms_agreed":true,"privacy_agreed":true,"age_confirmed":true}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin@test.local', 'authenticated', 'authenticated',
   '{"name":"관리자","terms_agreed":true,"privacy_agreed":true,"age_confirmed":true}');
insert into public.admins (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.categories (id, slug, name, is_active) values
  ('c0000000-0000-4000-8000-000000000001', 'test-visible', '보임', true),
  ('c0000000-0000-4000-8000-000000000002', 'test-hidden', '숨김', false);
insert into public.products (id, slug, name, price, status) values
  ('f0000000-0000-4000-8000-000000000001', 'test-active', '판매중', 10000, 'active'),
  ('f0000000-0000-4000-8000-000000000002', 'test-draft', '초안', 10000, 'draft'),
  ('f0000000-0000-4000-8000-000000000003', 'test-archived', '보관', 10000, 'archived');
insert into public.product_variants (product_id, sku, size, stock) values
  ('f0000000-0000-4000-8000-000000000001', 'T-1', 'M', 1),
  ('f0000000-0000-4000-8000-000000000002', 'T-2', 'M', 1),
  ('f0000000-0000-4000-8000-000000000003', 'T-3', 'M', 1);
insert into public.product_images (product_id, storage_path) values
  ('f0000000-0000-4000-8000-000000000001', 'products/x/1.webp'),
  ('f0000000-0000-4000-8000-000000000002', 'products/x/2.webp');
insert into public.home_sections (id, kind, title, is_active) values
  ('d0000000-0000-4000-8000-000000000001', 'hero', 'on', true),
  ('d0000000-0000-4000-8000-000000000002', 'hero', 'off', false);

-- anon --------------------------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is(public.is_admin(), false, 'anon is not admin');
select is((select count(*)::int from public.products where slug like 'test-%'), 1, 'anon sees only active products');
select is((select count(*)::int from public.products where id = 'f0000000-0000-4000-8000-000000000002'), 0, 'anon sees 0 draft products');
select is((select count(*)::int from public.product_variants where sku like 'T-%'), 1, 'anon sees variants of active products only');
select is((select count(*)::int from public.product_images where storage_path like 'products/x/%'), 1, 'anon sees images of active products only');
select is((select count(*)::int from public.categories where slug like 'test-%'), 1, 'anon sees active categories only');
select is((select count(*)::int from public.home_sections where id in ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002')), 1, 'anon sees active home sections only');
select is((select count(*)::int from public.site_settings), 1, 'anon can read site_settings');

select throws_ok($$select * from public.profiles$$, '42501', null, 'anon cannot read profiles');
select throws_ok($$select * from public.admins$$, '42501', null, 'anon cannot read admins');
select throws_ok($$select * from public.audit_logs$$, '42501', null, 'anon cannot read audit_logs');
select throws_ok($$select * from public.addresses$$, '42501', null, 'anon cannot read addresses');
select throws_ok($$insert into public.products (slug, name, price) values ('anon-x', 'x', 1)$$, '42501', null, 'anon cannot insert products');
select throws_ok($$update public.site_settings set bank_account = 'x'$$, '42501', null, 'anon cannot update site_settings');
reset role;

-- non-admin user ----------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is(public.is_admin(), false, 'regular user is not admin');
select is((select count(*)::int from public.products where slug like 'test-%'), 1, 'user sees only active products');
select throws_ok(
  $$insert into public.products (slug, name, price) values ('user-x', 'x', 1)$$,
  '42501', null, 'user cannot insert products (RLS)'
);
update public.products set price = 1 where id = 'f0000000-0000-4000-8000-000000000001';
delete from public.categories where id = 'c0000000-0000-4000-8000-000000000001';
update public.site_settings set bank_account = 'hacked' where id = 1;
select throws_ok(
  $$insert into public.admins (user_id) values ('11111111-1111-4111-8111-111111111111')$$,
  '42501', null, 'user cannot make themselves admin'
);
select is((select count(*)::int from public.admins), 0, 'user sees no admin rows');
select is((select count(*)::int from public.audit_logs), 0, 'user sees no audit logs');

-- profiles
select is((select count(*)::int from public.profiles), 1, 'user sees only their own profile');
select throws_ok(
  $$update public.profiles set email = 'evil@test.local' where id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', null, 'profiles.email is not updatable by users'
);
select throws_ok(
  $$update public.profiles set terms_agreed_at = now() where id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', null, 'consent timestamps are not updatable by users'
);
update public.profiles set name = '새이름', phone = '01099998888' where id = '11111111-1111-4111-8111-111111111111';
update public.profiles set name = '탈취' where id = '22222222-2222-4222-8222-222222222222';
select throws_ok(
  $$delete from public.profiles where id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', null, 'profiles cannot be deleted through the API'
);

-- storage: uploads are admin-only
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('products', 'f0000000-0000-4000-8000-000000000001/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp')$$,
  '42501', null, 'user cannot upload to products bucket'
);
reset role;

select is((select price from public.products where id = 'f0000000-0000-4000-8000-000000000001'), 10000, 'user update on products had no effect');
select is((select count(*)::int from public.categories where id = 'c0000000-0000-4000-8000-000000000001'), 1, 'user delete on categories had no effect');
select isnt((select bank_account from public.site_settings where id = 1), 'hacked', 'user update on site_settings had no effect');
select results_eq(
  $$select name, phone from public.profiles where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222') order by id$$,
  $$values ('새이름'::text, '01099998888'::text), ('유저2'::text, null::text)$$,
  'user can edit own name/phone only'
);

-- admin -------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select is((select count(*)::int from public.products where slug like 'test-%'), 3, 'admin sees draft and archived products');
select lives_ok(
  $$update public.products set price = 12000 where id = 'f0000000-0000-4000-8000-000000000001'$$,
  'admin can update products'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('products', '../../etc/passwd')$$,
  '42501', null, 'admin upload must match {uuid}/{uuid}(_m).webp'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('products', 'f0000000-0000-4000-8000-000000000001/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa_m.webp')$$,
  'admin upload with a valid key passes RLS'
);
reset role;

select * from finish();
rollback;
