import { queryOptions, useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth/session';
import type { CartLine } from '@/features/cart/store';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import type { FreshVariant } from './reconcile';

/** site_settings.updated_by (admin UUID) is not readable by anon/authenticated (0009). */
export type SiteSettings = Omit<Tables<'site_settings'>, 'updated_by'>;
export type Order = Tables<'orders'>;
export type OrderItem = Tables<'order_items'>;
type OrderEvent = Tables<'order_events'>;

/* --------------------------------------------------------------- settings */

const SITE_SETTINGS_COLUMNS =
  'id, shipping_fee, free_shipping_threshold, bank_name, bank_account, bank_holder, payment_due_hours, updated_at';

/** The single site_settings row, cached under qk.settings. */
async function fetchSiteSettings(): Promise<SiteSettings> {
  const { data, error } = await supabase
    .from('site_settings')
    .select(SITE_SETTINGS_COLUMNS)
    .eq('id', 1)
    .single();
  if (error) throw error;
  return data;
}

export const settingsQuery = queryOptions({
  queryKey: qk.settings,
  queryFn: fetchSiteSettings,
  staleTime: 5 * 60_000,
});

export const useSiteSettings = () => useQuery(settingsQuery);

/* ------------------------------------------------------- cart reconciling */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Current price, stock and availability of the cart's variants. Variants of products that are not
 * active are hidden by RLS and simply come back missing.
 */
export async function fetchCartVariants(lines: CartLine[]): Promise<FreshVariant[]> {
  const ids = lines.map((line) => line.variantId).filter((id) => UUID.test(id));
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('product_variants')
    .select('id, stock, is_active, price_delta, product:products!inner(price, status)')
    .in('id', ids);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    stock: row.stock,
    available: row.is_active && row.product.status === 'active',
    unitPrice: row.product.price + row.price_delta,
  }));
}

/* ----------------------------------------------------------------- orders */

export type CreateOrderInput = {
  items: { variant_id: string; quantity: number }[];
  address: {
    recipient: string;
    phone: string;
    postal_code: string;
    address1: string;
    address2: string;
  };
  memo: string;
  depositor_name: string;
};

export type CreateOrderResult = {
  order_id: string;
  order_no: string;
  total: number;
  payment_due_at: string;
  bank: { bank_name: string; bank_account: string; bank_holder: string };
};

/** Places the order. Prices, shipping fee and the bank account are decided by the server. */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const { data, error } = await supabase.rpc('create_order', {
    p_items: input.items,
    p_address: input.address,
    p_memo: input.memo,
    p_depositor_name: input.depositor_name,
  });
  if (error) throw error;
  return data as CreateOrderResult;
}

function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID.test(value);
}

export type OrderListItem = Pick<
  Order,
  'id' | 'order_no' | 'status' | 'total' | 'created_at' | 'cancel_requested_at'
> & {
  items: Pick<OrderItem, 'product_name' | 'variant_label' | 'quantity' | 'image_path'>[];
};

export const ORDERS_PAGE_SIZE = 10;

/** One page (0-based) of the signed-in user's orders, newest first. */
async function fetchMyOrders(
  userId: string,
  page: number,
): Promise<{ items: OrderListItem[]; total: number }> {
  const from = page * ORDERS_PAGE_SIZE;
  const { data, error, count } = await supabase
    .from('orders')
    .select(
      'id, order_no, status, total, created_at, cancel_requested_at, items:order_items(product_name, variant_label, quantity, image_path)',
      { count: 'exact' },
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, from + ORDERS_PAGE_SIZE - 1);
  if (error) throw error;
  return { items: data, total: count ?? 0 };
}

export function useMyOrders(page: number) {
  const { user } = useSession();
  return useQuery({
    queryKey: [...qk.orders(user?.id), 'list', page],
    queryFn: () => fetchMyOrders(user!.id, page),
    enabled: Boolean(user),
    placeholderData: (previous) => previous,
  });
}

/**
 * The customer's view of an order. orders.admin_note and order_events.actor_id/note are admin-only
 * and not readable with the customer's role (0009); the admin screen uses admin_get_order.
 */
export type OrderDetail = Pick<
  Order,
  | 'id'
  | 'order_no'
  | 'status'
  | 'subtotal'
  | 'shipping_fee'
  | 'total'
  | 'recipient'
  | 'phone'
  | 'postal_code'
  | 'address1'
  | 'address2'
  | 'memo'
  | 'depositor_name'
  | 'bank_name'
  | 'bank_account'
  | 'bank_holder'
  | 'payment_due_at'
  | 'cancel_reason'
  | 'cancel_requested_at'
  | 'carrier'
  | 'tracking_no'
  | 'created_at'
> & {
  items: OrderItem[];
  events: Pick<OrderEvent, 'id' | 'from_status' | 'to_status' | 'created_at'>[];
};

const ORDER_DETAIL_COLUMNS =
  'id, order_no, status, subtotal, shipping_fee, total, recipient, phone, postal_code, address1, address2, memo, depositor_name, bank_name, bank_account, bank_holder, payment_due_at, cancel_reason, cancel_requested_at, carrier, tracking_no, created_at, items:order_items(*), events:order_events(id, from_status, to_status, created_at)';

/** An order the current user may read (RLS), or null when it does not exist or is not theirs. */
async function fetchOrder(id: string): Promise<OrderDetail | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_DETAIL_COLUMNS)
    .eq('id', id)
    .order('id', { referencedTable: 'order_items', ascending: true })
    .order('created_at', { referencedTable: 'order_events', ascending: true })
    .order('id', { referencedTable: 'order_events', ascending: true })
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function useOrder(id: string) {
  const { user } = useSession();
  return useQuery({
    // Scoped per user: the same id must not show a cached order after switching accounts.
    queryKey: [...qk.order(id), user?.id],
    queryFn: () => fetchOrder(id),
    enabled: Boolean(user),
  });
}

/**
 * pending_payment → cancelled (stock restored by the server); paid/preparing → cancel request
 * with a reason.
 */
export async function cancelMyOrder(orderId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_my_order', {
    p_order_id: orderId,
    p_reason: reason,
  });
  if (error) throw error;
}
