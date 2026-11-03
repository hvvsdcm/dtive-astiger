-- Auth → profiles --------------------------------------------------------------------------------

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_update();

-- updated_at -------------------------------------------------------------------------------------

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.home_sections
  for each row execute function public.set_updated_at();

create trigger set_updated_by before update on public.site_settings
  for each row execute function public.set_settings_updated_by();

-- addresses --------------------------------------------------------------------------------------

create trigger ensure_single_default_address
  before insert or update of is_default on public.addresses
  for each row
  when (new.is_default)
  execute function public.ensure_single_default_address();

-- audit ------------------------------------------------------------------------------------------

create trigger log_audit after insert or update or delete on public.products
  for each row execute function public.log_audit();
create trigger log_audit after insert or update or delete on public.product_variants
  for each row execute function public.log_audit();
create trigger log_audit after insert or update or delete on public.product_images
  for each row execute function public.log_audit();
create trigger log_audit after insert or update or delete on public.categories
  for each row execute function public.log_audit();
create trigger log_audit after insert or update or delete on public.orders
  for each row execute function public.log_audit();
create trigger log_audit after insert or update or delete on public.site_settings
  for each row execute function public.log_audit();
create trigger log_audit after insert or update or delete on public.home_sections
  for each row execute function public.log_audit();

-- cron: cancel overdue bank-transfer orders every 10 minutes ------------------------------------
-- Skipped when pg_cron is not enabled (hosted: enable it, then re-run this block; see docs).
-- The admin dashboard button calls the same function as a fallback.

do $$
begin
  if exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    perform cron.schedule('expire-unpaid-orders', '*/10 * * * *', $cron$select public.expire_unpaid_orders()$cron$);
  end if;
end
$$;
