-- Members ----------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null check (char_length(name) between 1 and 40),
  phone text check (phone is null or phone ~ '^01[0-9]{8,9}$'),
  terms_agreed_at timestamptz not null,
  privacy_agreed_at timestamptz not null,
  marketing_agreed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Admin membership is granted with SQL only (no API write policy). See docs/SUPABASE_SETUP.md.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  note text
);

-- Catalog ----------------------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  parent_id uuid references public.categories (id) on delete set null,
  image_path text,
  sort int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index categories_parent_sort_idx on public.categories (parent_id, sort);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text not null default '',
  material text not null default '',
  care text not null default '',
  price integer not null check (price >= 0),
  compare_at_price integer check (compare_at_price is null or compare_at_price > price),
  category_id uuid references public.categories (id) on delete set null,
  status public.product_status not null default 'draft',
  is_featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_status_created_idx on public.products (status, created_at desc);
create index products_category_idx on public.products (category_id);
create index products_name_trgm_idx on public.products using gin (name extensions.gin_trgm_ops);
create index products_description_trgm_idx on public.products using gin (description extensions.gin_trgm_ops);

-- storage_path: 'products/{product_id}/{uuid}.webp'. The 800px copy is '…_m.webp' (derived, not stored).
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  alt text not null default '',
  color text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_sort_idx on public.product_images (product_id, sort);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique,
  color text not null default '',
  size text not null default '',
  stock integer not null default 0 check (stock >= 0),
  price_delta integer not null default 0,
  sort int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, color, size)
);

-- Customer data ----------------------------------------------------------------------------------

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default '',
  recipient text not null,
  phone text not null check (phone ~ '^01[0-9]{8,9}$'),
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  address1 text not null,
  address2 text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);
create unique index addresses_one_default on public.addresses (user_id) where is_default;

create table public.wishlist_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index wishlist_items_product_idx on public.wishlist_items (product_id);

-- Orders (bank transfer only) --------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  user_id uuid references public.profiles (id) on delete set null,
  status public.order_status not null default 'pending_payment',
  payment_method text not null default 'bank_transfer' check (payment_method = 'bank_transfer'),
  subtotal integer not null check (subtotal >= 0),
  shipping_fee integer not null check (shipping_fee >= 0),
  total integer not null check (total = subtotal + shipping_fee),
  recipient text not null,
  phone text not null,
  postal_code text not null,
  address1 text not null,
  address2 text not null default '',
  memo text not null default '' check (char_length(memo) <= 200),
  depositor_name text not null check (char_length(depositor_name) between 1 and 20),
  -- bank account snapshot taken from site_settings when the order was placed
  bank_name text not null,
  bank_account text not null,
  bank_holder text not null,
  payment_due_at timestamptz not null,
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  cancel_reason text,
  cancel_requested_at timestamptz,
  carrier text,
  tracking_no text,
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_status_created_idx on public.orders (status, created_at desc);
create index orders_pending_due_idx on public.orders (status, payment_due_at) where status = 'pending_payment';
create index orders_created_idx on public.orders (created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  variant_label text not null,
  sku text not null,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 10),
  image_path text,
  line_total integer generated always as (unit_price * quantity) stored
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);
create index order_items_variant_idx on public.order_items (variant_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  actor_id uuid,
  from_status public.order_status,
  to_status public.order_status not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index order_events_order_created_idx on public.order_events (order_id, created_at);

-- Store settings & content -----------------------------------------------------------------------

create table public.site_settings (
  id smallint primary key default 1 check (id = 1),
  shipping_fee integer not null default 3000 check (shipping_fee >= 0),
  free_shipping_threshold integer default 100000
    check (free_shipping_threshold is null or free_shipping_threshold > 0),
  bank_name text not null default '',
  bank_account text not null default '',
  bank_holder text not null default '',
  payment_due_hours integer not null default 48 check (payment_due_hours between 1 and 168),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- Singleton row must exist in every environment (production gets no seed.sql).
insert into public.site_settings (id) values (1) on conflict (id) do nothing;

-- items (lookbook only): [{ "image_path": string, "caption": string, "href": string }]
create table public.home_sections (
  id uuid primary key default gen_random_uuid(),
  kind public.home_section_kind not null,
  title text not null default '',
  link_label text not null default '',
  link_href text not null default '',
  image_path text,
  image_path_2 text,
  category_id uuid references public.categories (id) on delete set null,
  product_ids uuid[] not null default '{}',
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array'),
  sort int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index home_sections_sort_idx on public.home_sections (sort);
create index home_sections_category_idx on public.home_sections (category_id);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE', 'ACCOUNT_DELETED')),
  table_name text not null,
  row_id text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
