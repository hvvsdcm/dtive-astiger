-- Extensions live in the `extensions` schema (Supabase convention); code references them schema-qualified.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- pg_cron is available locally. On hosted projects enable it under
-- Dashboard > Database > Extensions before `supabase db push`; 0007 skips scheduling when it is absent.
do $$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
  end if;
end
$$;
