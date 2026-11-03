create type public.order_status as enum (
  'pending_payment',
  'paid',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
);

create type public.product_status as enum ('draft', 'active', 'archived');

create type public.home_section_kind as enum ('hero', 'split', 'collection', 'lookbook');
