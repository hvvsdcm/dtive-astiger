-- Admin access requires a second factor (TOTP, Supabase Auth MFA).
--
-- is_admin() is the only admin check in RLS policies, Storage policies, the admin_* functions,
-- expire_unpaid_orders and the stock trigger, so requiring `aal2` here covers all of them. A
-- password-only (aal1) session of an admin gets exactly what a customer gets. pg_cron and
-- service_role calls of expire_unpaid_orders do not go through is_admin() and are unchanged.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
     and exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- Routing only: whether the caller is listed in admins, whatever the assurance level. The admin
-- screens use it to send a password-only admin to the TOTP screen instead of the home page. Never
-- use it to grant access; that is is_admin().
create or replace function public.is_admin_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin_member() from public, anon, authenticated;
grant execute on function public.is_admin_member() to authenticated;
