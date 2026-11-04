-- Admin rights need a TOTP-verified session (aal2); is_admin_member() reports membership only.
begin;
select plan(26);

-- fixture (as postgres) --------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'u1@test.local', 'authenticated', 'authenticated',
   '{"name":"유저1","terms_agreed":true,"privacy_agreed":true,"age_confirmed":true}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin@test.local', 'authenticated', 'authenticated',
   '{"name":"관리자","terms_agreed":true,"privacy_agreed":true,"age_confirmed":true}');
insert into public.admins (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

-- a draft product (admins only) whose insert also writes an audit log row (admins only)
insert into public.products (id, slug, name, price, status) values
  ('f0000000-0000-4000-8000-000000000001', 'test-draft', '테스트', 10000, 'draft');

select ok(not has_function_privilege('anon', 'public.is_admin_member()', 'execute'),
  'anon cannot execute is_admin_member()');
select ok(has_function_privilege('authenticated', 'public.is_admin_member()', 'execute'),
  'signed-in users can execute is_admin_member()');

-- admin signed in with a password only (aal1) ----------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","aal":"aal1"}';
select is(public.is_admin(), false, 'aal1 admin: is_admin() is false');
select is(public.is_admin_member(), true, 'aal1 admin: is_admin_member() is true');
select throws_ok($$select public.admin_dashboard_stats()$$, 'P0001', 'FORBIDDEN',
  'aal1 admin: admin_dashboard_stats → FORBIDDEN');
select throws_ok($$select public.admin_get_order(gen_random_uuid())$$, 'P0001', 'FORBIDDEN',
  'aal1 admin: admin_get_order → FORBIDDEN');
select throws_ok($$select public.expire_unpaid_orders()$$, 'P0001', 'FORBIDDEN',
  'aal1 admin: expire_unpaid_orders → FORBIDDEN');
select is((select count(*)::int from public.audit_logs), 0, 'aal1 admin reads no audit logs');
select is((select count(*)::int from public.products where slug = 'test-draft'), 0,
  'aal1 admin does not see draft products');
select is((select count(*)::int from public.profiles), 1, 'aal1 admin reads only their own profile');
select throws_ok(
  $$insert into public.products (slug, name, price) values ('test-aal1', 'x', 1)$$,
  '42501', null, 'aal1 admin cannot insert products');
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('products', 'f0000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000a1.webp')$$,
  '42501', null, 'aal1 admin cannot upload to storage');

-- admin without any aal claim (never issued by Supabase Auth, still refused)
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
select is(public.is_admin(), false, 'admin without an aal claim: is_admin() is false');

-- admin after the TOTP step (aal2) ---------------------------------------------------------------
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","aal":"aal2"}';
select is(public.is_admin(), true, 'aal2 admin: is_admin() is true');
select lives_ok($$select public.admin_dashboard_stats()$$, 'aal2 admin: admin_dashboard_stats runs');
select lives_ok($$select public.admin_get_order(gen_random_uuid())$$,
  'aal2 admin: admin_get_order passes the admin check');
select ok((select count(*) from public.audit_logs) > 0, 'aal2 admin reads audit logs');
select is((select count(*)::int from public.products where slug = 'test-draft'), 1,
  'aal2 admin sees draft products');
select is((select count(*)::int from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 1,
  'aal2 admin reads customer profiles');
select lives_ok(
  $$insert into public.products (slug, name, price) values ('test-aal2', 'x', 1)$$,
  'aal2 admin can insert products');
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('products', 'f0000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000a1.webp')$$,
  'aal2 admin can upload to storage');

-- a customer, even with TOTP, is neither ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}';
select is(public.is_admin(), false, 'aal2 customer: is_admin() is false');
select is(public.is_admin_member(), false, 'customer: is_admin_member() is false');
select throws_ok($$select public.admin_dashboard_stats()$$, 'P0001', 'FORBIDDEN',
  'aal2 customer: admin_dashboard_stats → FORBIDDEN');
reset role;

-- anon -------------------------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is(public.is_admin(), false, 'anon: is_admin() is false');
select throws_ok($$select public.is_admin_member()$$, '42501', null,
  'anon: is_admin_member() is not executable');
reset role;

select * from finish();
rollback;
