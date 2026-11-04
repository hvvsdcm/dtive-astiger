-- Storage listing, home-section link targets and stock writes from the admin editor.

-- Storage ----------------------------------------------------------------------------------------
-- Public buckets serve /storage/v1/object/public/… without RLS, so visitors need no select policy.
-- Only admins may list objects (the list API exposes draft product ids and inactive banners);
-- uploads and deletes keep working because they are admin-only too.
drop policy storage_images_select on storage.objects;
create policy storage_images_select on storage.objects
  for select to authenticated
  using ((select public.is_admin()) and bucket_id in ('products', 'banners'));

-- Home-section links -----------------------------------------------------------------------------
-- Same rule as src/lib/internalHref.ts: a path inside this app. "//host", "/\host", schemes,
-- whitespace (browsers drop tabs/newlines, so "/<TAB>/host" becomes "//host") and control
-- characters are rejected. '' means "no link".
alter table public.home_sections
  add constraint home_sections_link_href_internal
  check (link_href = '' or link_href ~ '^/([^/\\[:space:][:cntrl:]][^\\[:space:][:cntrl:]]*)?$');

-- Lookbook items: [{ "image_path": string, "caption": string, "href": string }]; every href follows
-- the link_href rule above.
create or replace function public.check_home_section_items()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
      from jsonb_array_elements(new.items) as item
     where jsonb_typeof(item) <> 'object'
        or (item ? 'href' and jsonb_typeof(item -> 'href') <> 'string')
        or not (
          coalesce(item ->> 'href', '') = ''
          or (item ->> 'href') ~ '^/([^/\\[:space:][:cntrl:]][^\\[:space:][:cntrl:]]*)?$'
        )
  ) then
    raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.check_home_section_items() from public, anon, authenticated;

create trigger check_items before insert or update of items on public.home_sections
  for each row execute function public.check_home_section_items();

-- Stock ------------------------------------------------------------------------------------------
-- The product editor no longer writes stock in its upsert (that overwrote orders placed while the
-- editor was open). Admins keep column grants for the other fields; new variants are inserted with
-- their initial stock, and changes to existing stock go through admin_set_stock.
revoke update on public.product_variants from authenticated;
grant update (id, product_id, sku, color, size, price_delta, sort, is_active)
  on public.product_variants to authenticated;

-- Sets stock for variants of one product, all or nothing. p_expected is the stock the editor read;
-- when any row changed since then (an order, a cancellation, another admin) nothing is written and
-- STOCK_CHANGED is raised with that variant id in `detail`.
create or replace function public.admin_set_stock(
  p_product_id uuid,
  p_variant_ids uuid[],
  p_expected integer[],
  p_stock integer[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := coalesce(cardinality(p_variant_ids), 0);
  v_changed uuid;
begin
  if not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if v_count = 0
     or v_count > 500
     or coalesce(cardinality(p_expected), -1) <> v_count
     or coalesce(cardinality(p_stock), -1) <> v_count
     or v_count <> (select count(distinct x) from unnest(p_variant_ids) x where x is not null)
     or exists (
       select 1
         from unnest(p_expected, p_stock) as t (expected, stock)
        where t.expected is null or t.stock is null
           or t.expected < 0 or t.stock not between 0 and 999999
     ) then
    raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
  end if;

  -- Same lock order as create_order (by id).
  perform 1
     from public.product_variants v
    where v.id = any (p_variant_ids)
      and v.product_id = p_product_id
    order by v.id
      for update;
  if (select count(*) from public.product_variants v
       where v.id = any (p_variant_ids) and v.product_id = p_product_id) <> v_count then
    raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
  end if;

  select v.id into v_changed
    from unnest(p_variant_ids, p_expected) as t (id, expected)
    join public.product_variants v on v.id = t.id
   where v.stock <> t.expected
   order by v.id
   limit 1;
  if v_changed is not null then
    raise exception using message = 'STOCK_CHANGED', detail = v_changed::text, errcode = 'P0001';
  end if;

  update public.product_variants v
     set stock = t.stock
    from unnest(p_variant_ids, p_stock) as t (id, stock)
   where v.id = t.id
     and v.stock <> t.stock;
end;
$$;
revoke all on function public.admin_set_stock(uuid, uuid[], integer[], integer[]) from public, anon, authenticated;
grant execute on function public.admin_set_stock(uuid, uuid[], integer[], integer[]) to authenticated;
