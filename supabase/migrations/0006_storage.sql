-- Public image buckets. Locally config.toml ([storage.buckets.*]) also creates them and uploads
-- supabase/seed-assets; on hosted projects this insert creates them on `supabase db push`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('products', 'products', true, 5242880, array['image/webp', 'image/jpeg', 'image/png']),
  ('banners', 'banners', true, 8388608, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Object names: '{owner_uuid}/{uuid}.webp' (2000px) and '{owner_uuid}/{uuid}_m.webp' (800px).
-- The DB stores '{bucket}/{name}' in *_path columns.

create policy storage_images_select on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('products', 'banners'));

create policy storage_images_insert on storage.objects
  for insert to authenticated
  with check (
    (select public.is_admin())
    and bucket_id in ('products', 'banners')
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}(_m)?\.webp$'
  );

create policy storage_images_update on storage.objects
  for update to authenticated
  using ((select public.is_admin()) and bucket_id in ('products', 'banners'))
  with check (
    (select public.is_admin())
    and bucket_id in ('products', 'banners')
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}(_m)?\.webp$'
  );

create policy storage_images_delete on storage.objects
  for delete to authenticated
  using ((select public.is_admin()) and bucket_id in ('products', 'banners'));
