-- Row Level Security on every table. FORCE applies policies to the table owner too; the
-- security definer functions in 0004 run as `postgres` (BYPASSRLS) and remain the only write path
-- for orders, profiles creation and account deletion.
-- Policies wrap auth.uid()/is_admin() in sub-selects so they are evaluated once per statement.

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.admins enable row level security;
alter table public.admins force row level security;
alter table public.categories enable row level security;
alter table public.categories force row level security;
alter table public.products enable row level security;
alter table public.products force row level security;
alter table public.product_images enable row level security;
alter table public.product_images force row level security;
alter table public.product_variants enable row level security;
alter table public.product_variants force row level security;
alter table public.addresses enable row level security;
alter table public.addresses force row level security;
alter table public.wishlist_items enable row level security;
alter table public.wishlist_items force row level security;
alter table public.orders enable row level security;
alter table public.orders force row level security;
alter table public.order_items enable row level security;
alter table public.order_items force row level security;
alter table public.order_events enable row level security;
alter table public.order_events force row level security;
alter table public.site_settings enable row level security;
alter table public.site_settings force row level security;
alter table public.home_sections enable row level security;
alter table public.home_sections force row level security;
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

-- Table privileges (defence in depth on top of RLS) ----------------------------------------------
-- Supabase default privileges grant ALL on new public tables to anon/authenticated.
-- Reduce them to what the policies below can ever allow.

revoke all on
  public.profiles, public.admins, public.categories, public.products, public.product_images,
  public.product_variants, public.addresses, public.wishlist_items, public.orders, public.order_items,
  public.order_events, public.site_settings, public.home_sections, public.audit_logs
from anon, authenticated;

-- public catalog (read by anyone)
grant select on public.categories, public.products, public.product_images, public.product_variants,
  public.site_settings, public.home_sections
to anon, authenticated;

-- admin-managed catalog/content (RLS: is_admin())
grant insert, update, delete on public.categories, public.products, public.product_images,
  public.product_variants, public.home_sections
to authenticated;
grant update on public.site_settings to authenticated;

-- members
grant select on public.profiles, public.admins, public.orders, public.order_items, public.order_events,
  public.audit_logs
to authenticated;
-- profiles: only these columns are user-editable; email and consent timestamps change via triggers only
grant update (name, phone, marketing_agreed_at) on public.profiles to authenticated;
grant select, insert, update, delete on public.addresses to authenticated;
grant select, insert, delete on public.wishlist_items to authenticated;
-- orders: admins may edit notes/tracking directly; status and amounts change only through RPCs
grant update (admin_note, carrier, tracking_no) on public.orders to authenticated;

-- profiles -------------------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- admins (no write policy: membership is managed with SQL only) --------------------------------
create policy admins_select on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- categories -----------------------------------------------------------------------------------
create policy categories_select on public.categories
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));
create policy categories_insert on public.categories
  for insert to authenticated
  with check ((select public.is_admin()));
create policy categories_update on public.categories
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy categories_delete on public.categories
  for delete to authenticated
  using ((select public.is_admin()));

-- products -------------------------------------------------------------------------------------
create policy products_select on public.products
  for select to anon, authenticated
  using (status = 'active' or (select public.is_admin()));
create policy products_insert on public.products
  for insert to authenticated
  with check ((select public.is_admin()));
create policy products_update on public.products
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy products_delete on public.products
  for delete to authenticated
  using ((select public.is_admin()));

-- product_images -------------------------------------------------------------------------------
create policy product_images_select on public.product_images
  for select to anon, authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
  );
create policy product_images_insert on public.product_images
  for insert to authenticated
  with check ((select public.is_admin()));
create policy product_images_update on public.product_images
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy product_images_delete on public.product_images
  for delete to authenticated
  using ((select public.is_admin()));

-- product_variants -----------------------------------------------------------------------------
create policy product_variants_select on public.product_variants
  for select to anon, authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
  );
create policy product_variants_insert on public.product_variants
  for insert to authenticated
  with check ((select public.is_admin()));
create policy product_variants_update on public.product_variants
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy product_variants_delete on public.product_variants
  for delete to authenticated
  using ((select public.is_admin()));

-- addresses ------------------------------------------------------------------------------------
create policy addresses_select on public.addresses
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy addresses_insert on public.addresses
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy addresses_update on public.addresses
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy addresses_delete on public.addresses
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- wishlist_items -------------------------------------------------------------------------------
create policy wishlist_items_select on public.wishlist_items
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy wishlist_items_insert on public.wishlist_items
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy wishlist_items_delete on public.wishlist_items
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- orders (insert via create_order only; no delete) ---------------------------------------------
create policy orders_select on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy orders_update on public.orders
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- order_items / order_events (read-only through the API) ---------------------------------------
create policy order_items_select on public.order_items
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );
create policy order_events_select on public.order_events
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );

-- site_settings (public read: shipping fee display; bank info is also snapshotted per order) ---
create policy site_settings_select on public.site_settings
  for select to anon, authenticated
  using (true);
create policy site_settings_update on public.site_settings
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- home_sections --------------------------------------------------------------------------------
create policy home_sections_select on public.home_sections
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));
create policy home_sections_insert on public.home_sections
  for insert to authenticated
  with check ((select public.is_admin()));
create policy home_sections_update on public.home_sections
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy home_sections_delete on public.home_sections
  for delete to authenticated
  using ((select public.is_admin()));

-- audit_logs (written by triggers/definer functions only) --------------------------------------
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using ((select public.is_admin()));
