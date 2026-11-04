-- Signup consent trigger, email sync, delete_my_account.
begin;
select plan(18);

-- signup ----------------------------------------------------------------------------------------
select throws_ok(
  $$insert into auth.users (id, email, aud, role, raw_user_meta_data)
    values ('33333333-3333-4333-8333-333333333333', 'noterms@test.local', 'authenticated', 'authenticated', '{"name":"x"}')$$,
  'P0001', 'TERMS_REQUIRED', 'signup without consents fails'
);
select throws_ok(
  $$insert into auth.users (id, email, aud, role, raw_user_meta_data)
    values ('33333333-3333-4333-8333-333333333333', 'noprivacy@test.local', 'authenticated', 'authenticated',
            '{"name":"x","terms_agreed":true,"privacy_agreed":false}')$$,
  'P0001', 'TERMS_REQUIRED', 'signup without privacy consent fails'
);
select throws_ok(
  $$insert into auth.users (id, email, aud, role, raw_user_meta_data)
    values ('33333333-3333-4333-8333-333333333333', 'string@test.local', 'authenticated', 'authenticated',
            '{"name":"x","terms_agreed":"true","privacy_agreed":"true"}')$$,
  'P0001', 'TERMS_REQUIRED', 'consents must be JSON booleans'
);
select throws_ok(
  $$insert into auth.users (id, email, aud, role, raw_user_meta_data)
    values ('33333333-3333-4333-8333-333333333333', 'noage@test.local', 'authenticated', 'authenticated',
            '{"name":"x","terms_agreed":true,"privacy_agreed":true}')$$,
  'P0001', 'TERMS_REQUIRED', 'signup without the age 14+ confirmation fails'
);
select throws_ok(
  $$insert into auth.users (id, email, aud, role, raw_user_meta_data)
    values ('33333333-3333-4333-8333-333333333333', 'under14@test.local', 'authenticated', 'authenticated',
            '{"name":"x","terms_agreed":true,"privacy_agreed":true,"age_confirmed":false}')$$,
  'P0001', 'TERMS_REQUIRED', 'signup with age_confirmed false fails'
);

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'u1@test.local', 'authenticated', 'authenticated',
   '{"name":"유저1","phone":"010-1111-2222","terms_agreed":true,"privacy_agreed":true,"age_confirmed":true,"marketing_agreed":false}'),
  ('22222222-2222-4222-8222-222222222222', 'u2@test.local', 'authenticated', 'authenticated',
   '{"name":"유저2","terms_agreed":true,"privacy_agreed":true,"age_confirmed":true,"marketing_agreed":true}');

select results_eq(
  $$select email, name, phone, terms_agreed_at is not null, privacy_agreed_at is not null,
           age_confirmed_at is not null, marketing_agreed_at is null
      from public.profiles where id = '11111111-1111-4111-8111-111111111111'$$,
  $$values ('u1@test.local'::text, '유저1'::text, '01011112222'::text, true, true, true, true)$$,
  'profile created from signup metadata (phone normalised, marketing off)'
);
select isnt((select marketing_agreed_at from public.profiles where id = '22222222-2222-4222-8222-222222222222'), null, 'marketing consent timestamped');

update auth.users set email = 'u1-new@test.local' where id = '11111111-1111-4111-8111-111111111111';
select is((select email from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 'u1-new@test.local', 'email change synced to profile');

-- fixture for deletion ----------------------------------------------------------------------------
insert into public.products (id, slug, name, price, status) values
  ('f0000000-0000-4000-8000-000000000001', 'test-active', '테스트', 10000, 'active');
insert into public.orders (id, order_no, user_id, status, subtotal, shipping_fee, total, recipient, phone, postal_code,
  address1, depositor_name, bank_name, bank_account, bank_holder, payment_due_at)
values ('0d000000-0000-4000-8000-000000000001', 'T-0001', '11111111-1111-4111-8111-111111111111', 'shipped', 10000, 3000, 13000,
        '유저1', '01011112222', '06236', '서울', '유저1', '은행', '1', '예금주', now() + interval '1 day');
insert into public.addresses (user_id, recipient, phone, postal_code, address1) values
  ('11111111-1111-4111-8111-111111111111', '유저1', '01011112222', '06236', '서울');
insert into public.wishlist_items (user_id, product_id) values
  ('11111111-1111-4111-8111-111111111111', 'f0000000-0000-4000-8000-000000000001');

-- anon cannot call it
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$select public.delete_my_account()$$, '42501', null, 'anon has no EXECUTE on delete_my_account');
reset role;

-- in-progress order blocks deletion
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok($$select public.delete_my_account()$$, 'P0001', 'ACTIVE_ORDERS', 'shipped order → ACTIVE_ORDERS');
reset role;

update public.orders set status = 'delivered' where id = '0d000000-0000-4000-8000-000000000001';

set local role authenticated;
select lives_ok($$select public.delete_my_account()$$, 'account deleted once orders are finished');
reset role;

select is((select count(*)::int from auth.users where id = '11111111-1111-4111-8111-111111111111'), 0, 'auth user removed');
select is((select count(*)::int from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 0, 'profile removed');
select is((select count(*)::int from public.addresses where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'addresses removed');
select is((select count(*)::int from public.wishlist_items where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'wishlist removed');
select results_eq(
  $$select user_id, recipient from public.orders where id = '0d000000-0000-4000-8000-000000000001'$$,
  $$values (null::uuid, '유저1'::text)$$,
  'order kept with user_id null and recipient snapshot'
);
select results_eq(
  $$select before is null, after is null from public.audit_logs
     where action = 'ACCOUNT_DELETED' and row_id = '11111111-1111-4111-8111-111111111111'$$,
  $$values (true, true)$$,
  'ACCOUNT_DELETED audit row keeps no e-mail/name (not even hashed)'
);
select is((select count(*)::int from public.profiles where id = '22222222-2222-4222-8222-222222222222'), 1, 'other accounts untouched');

select * from finish();
rollback;
