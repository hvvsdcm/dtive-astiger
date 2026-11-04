-- Signup also requires the "만 14세 이상" confirmation (terms §회원가입, privacy §12).
-- Existing profiles were created under terms that already excluded under-14s; their consent time
-- is carried over so the column can be not null.

alter table public.profiles add column age_confirmed_at timestamptz;
update public.profiles set age_confirmed_at = terms_agreed_at where age_confirmed_at is null;
alter table public.profiles alter column age_confirmed_at set not null;

-- Creates the profile row for every new auth user. Signup fails unless all required consents
-- (terms, privacy, age 14+) are JSON true.
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
     or v_meta -> 'privacy_agreed' is distinct from 'true'::jsonb
     or v_meta -> 'age_confirmed' is distinct from 'true'::jsonb then
    raise exception using message = 'TERMS_REQUIRED', errcode = 'P0001';
  end if;

  insert into public.profiles (
    id, email, name, phone, terms_agreed_at, privacy_agreed_at, age_confirmed_at, marketing_agreed_at
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(v_name, ''), left(split_part(coalesce(new.email, ''), '@', 1), 40)),
    v_phone,
    now(),
    now(),
    now(),
    case when v_meta -> 'marketing_agreed' = 'true'::jsonb then now() end
  );
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
