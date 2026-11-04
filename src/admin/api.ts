import { z } from 'zod';
import { searchTerm } from '@/features/catalog/model';
import { storageKey, type StorageBucket } from '@/lib/images';
import { imageResize } from '@/lib/imageResize';
import { rpcErrorMessage } from '@/lib/rpcErrors';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { OrderStatus, ProductStatus } from '@/types/domain';
import type {
  CategoryValues,
  ProductValues,
  SectionValues,
  SettingsValues,
  VariantRowValues,
} from './schemas';

type Tables = Database['public']['Tables'];
export type ProductRow = Tables['products']['Row'];
export type CategoryRow = Tables['categories']['Row'];

/** Admin category list (inactive included). Not in qk: the store's qk.categories is active-only. */
export const adminCategoriesKey = ['admin', 'categories'] as const;

const POSTGRES_UNIQUE_VIOLATION = '23505';

/**
 * Message for a failed admin write: unique-key clashes name the field, everything else goes
 * through rpcErrorMessage (server codes or a generic message, never raw SQL).
 */
export function adminErrorMessage(error: unknown): string {
  const { code, message, details } = (error ?? {}) as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
  if (code === POSTGRES_UNIQUE_VIOLATION) {
    const text = `${String(message)} ${String(details)}`;
    if (text.includes('sku')) return '이미 사용 중인 SKU가 있습니다';
    if (text.includes('slug')) return '이미 사용 중인 슬러그입니다';
    if (text.includes('color')) return '같은 색상·사이즈 조합이 있습니다';
  }
  return rpcErrorMessage(error);
}

// Images ------------------------------------------------------------------------------------------

/** One image as edited by ImageUploader; `storagePath` is "<bucket>/<owner>/<uuid>.webp". */
export type ImageItem = {
  /** product_images.id once saved; absent for uploads that are not stored in a row yet. */
  id?: string;
  storagePath: string;
  alt: string;
  color?: string | null;
  sort: number;
};

const mediumPath = (path: string) => path.replace(/\.webp$/, '_m.webp');

/**
 * Uploads the 2000px and 800px renditions of `file` under "<ownerId>/<uuid>[_m].webp" and returns
 * the stored path "<bucket>/<ownerId>/<uuid>.webp". The bucket enforces MIME type and size; the
 * storage policy enforces the name pattern and admin-only writes.
 */
export async function uploadImage(
  bucket: StorageBucket,
  ownerId: string,
  file: File,
): Promise<string> {
  const [large, medium] = await Promise.all([imageResize(file, 2000), imageResize(file, 800)]);
  const key = storageKey(bucket, ownerId, 'l');
  const storage = supabase.storage.from(bucket);
  const options = { cacheControl: '31536000', upsert: false };
  const first = await storage.upload(key, large, { ...options, contentType: large.type });
  if (first.error) throw first.error;
  const second = await storage.upload(mediumPath(key), medium, {
    ...options,
    contentType: medium.type,
  });
  if (second.error) {
    await storage.remove([key]);
    throw second.error;
  }
  return `${bucket}/${key}`;
}

/**
 * Removes both renditions of a stored image, but only when it lives in `ownerId`'s folder: seed
 * data and home sections reuse product photos by path, and those must survive. Callers run this
 * after the referencing row is gone and ignore its failure (a leftover file is harmless).
 */
export async function removeOwnedImages(paths: string[], ownerId: string): Promise<void> {
  const byBucket = new Map<string, string[]>();
  for (const path of paths) {
    const [bucket, owner, file] = path.split('/');
    if (!bucket || owner !== ownerId || !file) continue;
    const key = `${owner}/${file}`;
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), key, mediumPath(key)]);
  }
  for (const [bucket, keys] of byBucket) {
    const { error } = await supabase.storage.from(bucket).remove(keys);
    if (error) throw error;
  }
}

// Dashboard ---------------------------------------------------------------------------------------

const statsSchema = z.object({
  counts: z.object({
    pending_payment: z.number(),
    paid: z.number(),
    preparing: z.number(),
    shipped: z.number(),
  }),
  today_orders: z.number(),
  revenue_30d: z.number(),
  low_stock: z.array(
    z.object({
      variant_id: z.string(),
      product_name: z.string(),
      sku: z.string(),
      stock: z.number(),
    }),
  ),
  expired_pending: z.number(),
});

export type DashboardStats = z.infer<typeof statsSchema>;

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('admin_dashboard_stats');
  if (error) throw error;
  return statsSchema.parse(data);
}

// Products ----------------------------------------------------------------------------------------

export const ADMIN_PAGE_SIZE = 20;

export type AdminProductSort = 'updated' | 'created' | 'name' | 'price_asc' | 'price_desc';

export const ADMIN_PRODUCT_SORTS: { value: AdminProductSort; label: string }[] = [
  { value: 'updated', label: '최근 수정순' },
  { value: 'created', label: '최근 등록순' },
  { value: 'name', label: '이름순' },
  { value: 'price_asc', label: '낮은 가격순' },
  { value: 'price_desc', label: '높은 가격순' },
];

export type AdminProductFilters = {
  q: string;
  status: ProductStatus | 'all';
  sort: AdminProductSort;
  page: number;
};

export type AdminProductListItem = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  status: ProductStatus;
  updatedAt: string;
  categoryName: string | null;
  imagePath: string | null;
  totalStock: number;
};

const SORT_ORDER: Record<AdminProductSort, { column: string; ascending: boolean }> = {
  updated: { column: 'updated_at', ascending: false },
  created: { column: 'created_at', ascending: false },
  name: { column: 'name', ascending: true },
  price_asc: { column: 'price', ascending: true },
  price_desc: { column: 'price', ascending: false },
};

export async function fetchAdminProducts(
  filters: AdminProductFilters,
): Promise<{ items: AdminProductListItem[]; total: number }> {
  const order = SORT_ORDER[filters.sort];
  const from = (filters.page - 1) * ADMIN_PAGE_SIZE;
  let query = supabase
    .from('products')
    .select(
      'id, slug, name, price, compare_at_price, status, updated_at, category:categories(name), images:product_images(storage_path, sort), variants:product_variants(stock)',
      { count: 'exact' },
    )
    .order(order.column, { ascending: order.ascending })
    .order('id')
    .range(from, from + ADMIN_PAGE_SIZE - 1);
  if (filters.status !== 'all') query = query.eq('status', filters.status);
  const q = searchTerm(filters.q);
  if (q) query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`);

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    total: count ?? 0,
    items: data.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      price: row.price,
      compareAtPrice: row.compare_at_price,
      status: row.status,
      updatedAt: row.updated_at,
      categoryName: row.category?.name ?? null,
      imagePath: [...row.images].sort((a, b) => a.sort - b.sort)[0]?.storage_path ?? null,
      totalStock: row.variants.reduce((sum, v) => sum + v.stock, 0),
    })),
  };
}

export type AdminVariant = Tables['product_variants']['Row'];

export type AdminProduct = ProductRow & {
  images: Tables['product_images']['Row'][];
  variants: AdminVariant[];
};

/** Product with all images and variants, or null when the id does not exist. */
export async function fetchAdminProduct(id: string): Promise<AdminProduct | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, images:product_images(*), variants:product_variants(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    images: [...data.images].sort((a, b) => a.sort - b.sort),
    variants: [...data.variants].sort((a, b) => a.sort - b.sort),
  };
}

export type SaveProductInput = {
  id: string;
  isNew: boolean;
  /** published_at currently stored (kept once set). */
  publishedAt: string | null;
  values: ProductValues;
  /** Final rows in display order; `id` is generated client-side for new rows. */
  variants: VariantRowValues[];
  removedVariantIds: string[];
  /** Final images in display order. New ones get an id here. */
  images: ImageItem[];
  /** Saved images that were removed in the editor. */
  removedImages: ImageItem[];
};

/**
 * Saves a product in the order fixed by the plan: products → product_variants (delete, upsert) →
 * product_images (delete, upsert) → reorder_product_images. These are separate requests, so a
 * failure part-way leaves the earlier steps saved; the editor reloads and shows what was stored.
 */
export async function saveProduct(input: SaveProductInput): Promise<void> {
  const { values } = input;
  const productRow = {
    id: input.id,
    name: values.name,
    slug: values.slug,
    category_id: values.categoryId,
    price: values.price,
    compare_at_price: values.compareAtPrice,
    description: values.description,
    material: values.material,
    care: values.care,
    status: values.status,
    is_featured: values.isFeatured,
    published_at:
      input.publishedAt ?? (values.status === 'active' ? new Date().toISOString() : null),
  };
  const product = input.isNew
    ? await supabase.from('products').insert(productRow)
    : await supabase.from('products').update(productRow).eq('id', input.id);
  if (product.error) throw product.error;

  if (input.removedVariantIds.length > 0) {
    const { error } = await supabase
      .from('product_variants')
      .delete()
      .eq('product_id', input.id)
      .in('id', input.removedVariantIds);
    if (error) throw error;
  }
  if (input.variants.length > 0) {
    const { error } = await supabase.from('product_variants').upsert(
      input.variants.map((v, index) => ({
        id: v.id,
        product_id: input.id,
        sku: v.sku,
        color: v.color,
        size: v.size,
        stock: v.stock,
        price_delta: v.priceDelta,
        is_active: v.isActive,
        sort: index,
      })),
    );
    if (error) throw error;
  }

  const removedIds = input.removedImages.flatMap((image) => (image.id ? [image.id] : []));
  if (removedIds.length > 0) {
    const { error } = await supabase
      .from('product_images')
      .delete()
      .eq('product_id', input.id)
      .in('id', removedIds);
    if (error) throw error;
  }
  const images = input.images.map((image, index) => ({
    id: image.id ?? crypto.randomUUID(),
    product_id: input.id,
    storage_path: image.storagePath,
    alt: image.alt.trim(),
    color: image.color || null,
    sort: index,
  }));
  if (images.length > 0) {
    const { error } = await supabase.from('product_images').upsert(images);
    if (error) throw error;
    const reorder = await supabase.rpc('reorder_product_images', {
      p_product_id: input.id,
      p_image_ids: images.map((image) => image.id),
    });
    if (reorder.error) throw reorder.error;
  }
  // Rows are gone; their files can go too (only files in this product's folder).
  await removeOwnedImages(
    input.removedImages.map((image) => image.storagePath),
    input.id,
  ).catch(() => undefined);
}

/** Number of order lines that reference the product (such products are archived, not deleted). */
export async function countProductOrderItems(productId: string): Promise<number> {
  const { count, error } = await supabase
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);
  if (error) throw error;
  return count ?? 0;
}

export async function archiveProduct(productId: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ status: 'archived' })
    .eq('id', productId);
  if (error) throw error;
}

/** Deletes a product that has never been ordered (variants/images cascade), then its files. */
export async function deleteProduct(productId: string, imagePaths: string[]): Promise<void> {
  if ((await countProductOrderItems(productId)) > 0) {
    throw new Error('INVALID_TRANSITION');
  }
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) throw error;
  await removeOwnedImages(imagePaths, productId).catch(() => undefined);
}

// Categories --------------------------------------------------------------------------------------

export async function fetchAdminCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase.from('categories').select('*').order('sort').order('name');
  if (error) throw error;
  return data;
}

export type SaveCategoryInput = {
  id: string;
  isNew: boolean;
  values: CategoryValues;
  imagePath: string | null;
  /** Previously stored image path; removed from storage when replaced (own folder only). */
  previousImagePath: string | null;
  /** Sort for a new category (end of its sibling list). */
  sort: number;
};

export async function saveCategory(input: SaveCategoryInput): Promise<void> {
  const row = {
    name: input.values.name,
    slug: input.values.slug,
    parent_id: input.values.parentId || null,
    is_active: input.values.isActive,
    image_path: input.imagePath,
  };
  const { error } = input.isNew
    ? await supabase.from('categories').insert({ ...row, id: input.id, sort: input.sort })
    : await supabase.from('categories').update(row).eq('id', input.id);
  if (error) throw error;
  if (input.previousImagePath && input.previousImagePath !== input.imagePath) {
    await removeOwnedImages([input.previousImagePath], input.id).catch(() => undefined);
  }
}

/** Writes sort = position for the given sibling ids (only rows whose sort changes). */
export async function reorderCategories(ordered: { id: string; sort: number }[]): Promise<void> {
  const changed = ordered.flatMap((item, index) =>
    item.sort === index ? [] : [{ ...item, index }],
  );
  const results = await Promise.all(
    changed.map((item) =>
      supabase.from('categories').update({ sort: item.index }).eq('id', item.id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

export type CategoryImpact = { children: number; products: number; sections: number };

/** What a delete touches: subcategories become top level, products and home sections lose it. */
export async function fetchCategoryImpact(id: string): Promise<CategoryImpact> {
  const [children, products, sections] = await Promise.all([
    supabase.from('categories').select('id', { count: 'exact', head: true }).eq('parent_id', id),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('category_id', id),
    supabase
      .from('home_sections')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id),
  ]);
  const failed = [children, products, sections].find((result) => result.error);
  if (failed?.error) throw failed.error;
  return {
    children: children.count ?? 0,
    products: products.count ?? 0,
    sections: sections.count ?? 0,
  };
}

export async function deleteCategory(category: CategoryRow): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', category.id);
  if (error) throw error;
  if (category.image_path) {
    await removeOwnedImages([category.image_path], category.id).catch(() => undefined);
  }
}

// Search ------------------------------------------------------------------------------------------

/**
 * Free text for an `ilike` inside a PostgREST `or=(…)`: drops wildcards and the characters that
 * delimit or quote filter values, keeps "@", "." and "-" so e-mail addresses and order numbers match.
 */
export function adminSearchTerm(raw: string | null | undefined): string {
  return (raw ?? '')
    .replace(/[%_*,()"'\\:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string | null | undefined): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

/** "YYYY-MM-DD" (a day in Asia/Seoul) → the instant it starts, offset by `days`. */
function seoulDayStart(day: string, days = 0): string {
  const date = new Date(`${day}T00:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

// Orders ------------------------------------------------------------------------------------------

export type Order = Tables['orders']['Row'];
export type OrderItem = Tables['order_items']['Row'];
export type OrderEvent = Tables['order_events']['Row'];

/** Order list tab: a status, every order, or open cancel requests (paid/preparing with a request). */
export type AdminOrderTab = OrderStatus | 'all' | 'cancel_requested';

export type AdminOrderFilters = {
  status: AdminOrderTab;
  /** Order number, recipient, depositor, or the orderer's name / e-mail. */
  q: string;
  /** Inclusive "YYYY-MM-DD" days (Asia/Seoul); '' for open ends. */
  from: string;
  to: string;
  /** profiles.id to list one customer's orders; '' for everyone. */
  customer: string;
  page: number;
};

export type AdminOrderListItem = Pick<
  Order,
  | 'id'
  | 'order_no'
  | 'status'
  | 'total'
  | 'created_at'
  | 'depositor_name'
  | 'recipient'
  | 'payment_due_at'
  | 'cancel_requested_at'
  | 'user_id'
> & {
  /** Orderer's current name; null once the account is deleted. */
  customerName: string | null;
  /** "First product name" plus the number of other lines. */
  firstItem: string;
  otherItems: number;
  /** Still pending after the payment deadline (as of the fetch); the expiry job has not run yet. */
  paymentOverdue: boolean;
};

const ORDER_LIST_COLUMNS =
  'id, order_no, status, total, created_at, depositor_name, recipient, payment_due_at, cancel_requested_at, user_id, customer:profiles(name), items:order_items(product_name)';

type OrderListRow = Omit<
  AdminOrderListItem,
  'customerName' | 'firstItem' | 'otherItems' | 'paymentOverdue'
> & {
  customer: { name: string } | null;
  items: { product_name: string }[];
};

function toOrderListItem({ customer, items, ...row }: OrderListRow): AdminOrderListItem {
  return {
    ...row,
    customerName: customer?.name ?? null,
    firstItem: items[0]?.product_name ?? '',
    otherItems: Math.max(0, items.length - 1),
    paymentOverdue: row.status === 'pending_payment' && Date.parse(row.payment_due_at) < Date.now(),
  };
}

/** Ids of customers whose name or e-mail contains `term` (for the order search). */
async function matchingCustomerIds(term: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
    .limit(100);
  if (error) throw error;
  return data.map((row) => row.id);
}

export async function fetchAdminOrders(
  filters: AdminOrderFilters,
): Promise<{ items: AdminOrderListItem[]; total: number }> {
  const from = (filters.page - 1) * ADMIN_PAGE_SIZE;
  let query = supabase
    .from('orders')
    .select(ORDER_LIST_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id')
    .order('id', { referencedTable: 'order_items' })
    .range(from, from + ADMIN_PAGE_SIZE - 1);

  if (filters.status === 'cancel_requested') {
    query = query.not('cancel_requested_at', 'is', null).in('status', ['paid', 'preparing']);
  } else if (filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.from) query = query.gte('created_at', seoulDayStart(filters.from));
  if (filters.to) query = query.lt('created_at', seoulDayStart(filters.to, 1));
  if (isUuid(filters.customer)) query = query.eq('user_id', filters.customer);

  const term = adminSearchTerm(filters.q);
  if (term) {
    const clauses = [
      `order_no.ilike.%${term}%`,
      `recipient.ilike.%${term}%`,
      `depositor_name.ilike.%${term}%`,
    ];
    const ids = await matchingCustomerIds(term);
    if (ids.length) clauses.push(`user_id.in.(${ids.join(',')})`);
    query = query.or(clauses.join(','));
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { items: (data as OrderListRow[]).map(toOrderListItem), total: count ?? 0 };
}

/** Newest orders for the dashboard. */
export async function fetchRecentOrders(limit = 8): Promise<AdminOrderListItem[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .order('id', { referencedTable: 'order_items' })
    .limit(limit);
  if (error) throw error;
  return (data as OrderListRow[]).map(toOrderListItem);
}

/** Paid/preparing orders whose customer asked to cancel. */
export async function fetchCancelRequestCount(): Promise<number> {
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .not('cancel_requested_at', 'is', null)
    .in('status', ['paid', 'preparing']);
  if (error) throw error;
  return count ?? 0;
}

export type AdminOrderDetail = Order & {
  items: OrderItem[];
  events: OrderEvent[];
  /** Orderer's profile; null when the account was deleted (the order keeps its snapshots). */
  customer: { id: string; name: string; email: string; phone: string | null } | null;
};

/** Order with lines, events (oldest first) and orderer, or null when the id does not exist. */
export async function fetchAdminOrder(id: string): Promise<AdminOrderDetail | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase
    .from('orders')
    .select(
      '*, items:order_items(*), events:order_events(*), customer:profiles(id, name, email, phone)',
    )
    .eq('id', id)
    .order('id', { referencedTable: 'order_items' })
    .order('created_at', { referencedTable: 'order_events' })
    .order('id', { referencedTable: 'order_events' })
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** State change through admin_update_order_status (the server checks the transition table). */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  note: string,
): Promise<void> {
  const { error } = await supabase.rpc('admin_update_order_status', {
    p_order_id: orderId,
    p_status: status,
    p_note: note,
  });
  if (error) throw error;
}

/** paid/preparing → shipped with the waybill, or a waybill correction on a shipped order. */
export async function setOrderTracking(
  orderId: string,
  carrier: string,
  trackingNo: string,
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_tracking', {
    p_order_id: orderId,
    p_carrier: carrier,
    p_tracking_no: trackingNo,
  });
  if (error) throw error;
}

/** Internal memo (orders.admin_note is one of the three columns admins may update directly). */
export async function saveAdminNote(orderId: string, note: string): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ admin_note: note })
    .eq('id', orderId)
    .select('id')
    .single();
  if (error) throw error;
}

/** Cancels pending orders past their payment deadline; returns how many were cancelled. */
export async function expireUnpaidOrders(): Promise<number> {
  const { data, error } = await supabase.rpc('expire_unpaid_orders');
  if (error) throw error;
  return data;
}

// Customers ---------------------------------------------------------------------------------------

export type AdminCustomer = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  createdAt: string;
  marketingAgreedAt: string | null;
  orderCount: number;
};

export type AdminCustomerFilters = { q: string; page: number };

/** Profiles, newest first. `q` matches e-mail, name, or phone digits (hyphens ignored). */
export async function fetchAdminCustomers(
  filters: AdminCustomerFilters,
): Promise<{ items: AdminCustomer[]; total: number }> {
  const from = (filters.page - 1) * ADMIN_PAGE_SIZE;
  let query = supabase
    .from('profiles')
    .select('id, email, name, phone, created_at, marketing_agreed_at, orders(count)', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .order('id')
    .range(from, from + ADMIN_PAGE_SIZE - 1);

  const term = adminSearchTerm(filters.q);
  if (term) {
    const clauses = [`email.ilike.%${term}%`, `name.ilike.%${term}%`];
    const digits = term.replace(/[\s-]/g, '');
    if (/^\d{3,}$/.test(digits)) clauses.push(`phone.ilike.%${digits}%`);
    query = query.or(clauses.join(','));
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    total: count ?? 0,
    items: data.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      phone: row.phone,
      createdAt: row.created_at,
      marketingAgreedAt: row.marketing_agreed_at,
      orderCount: row.orders[0]?.count ?? 0,
    })),
  };
}

export type AdminCustomerDetail = Omit<AdminCustomer, 'orderCount'> & {
  orders: Pick<Order, 'id' | 'order_no' | 'status' | 'total' | 'created_at'>[];
};

export const CUSTOMER_RECENT_ORDERS = 10;

/** One profile with its newest orders, or null when the id does not exist. */
export async function fetchAdminCustomer(id: string): Promise<AdminCustomerDetail | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, name, phone, created_at, marketing_agreed_at, orders(id, order_no, status, total, created_at)',
    )
    .eq('id', id)
    .order('created_at', { referencedTable: 'orders', ascending: false })
    .limit(CUSTOMER_RECENT_ORDERS, { referencedTable: 'orders' })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    phone: data.phone,
    createdAt: data.created_at,
    marketingAgreedAt: data.marketing_agreed_at,
    orders: data.orders,
  };
}

// Home sections -----------------------------------------------------------------------------------

export type HomeSectionRow = Tables['home_sections']['Row'];

export type LookbookItemValue = { imagePath: string; caption: string; href: string };

const lookbookItemsSchema = z.array(
  z.object({
    image_path: z.string(),
    caption: z.string().catch(''),
    href: z.string().catch(''),
  }),
);

/** Lookbook items of a stored section; malformed jsonb reads as no items. */
export function lookbookItems(row: Pick<HomeSectionRow, 'items'>): LookbookItemValue[] {
  const parsed = lookbookItemsSchema.safeParse(row.items);
  if (!parsed.success) return [];
  return parsed.data.map((item) => ({
    imagePath: item.image_path,
    caption: item.caption,
    href: item.href,
  }));
}

/** Every stored image path a section references. */
export function sectionImagePaths(
  row: Pick<HomeSectionRow, 'image_path' | 'image_path_2' | 'items'>,
): string[] {
  return [
    row.image_path,
    row.image_path_2,
    ...lookbookItems(row).map((item) => item.imagePath),
  ].filter((path): path is string => Boolean(path));
}

/** All sections (inactive included) in display order. */
export async function fetchAdminSections(): Promise<HomeSectionRow[]> {
  const { data, error } = await supabase
    .from('home_sections')
    .select('*')
    .order('sort')
    .order('created_at');
  if (error) throw error;
  return data;
}

function sectionColumns(values: SectionValues) {
  const base = {
    kind: values.kind,
    title: values.title,
    link_label: values.linkLabel,
    link_href: values.linkHref,
    image_path: null as string | null,
    image_path_2: null as string | null,
    category_id: null as string | null,
    product_ids: [] as string[],
    items: [] as { image_path: string; caption: string; href: string }[],
  };
  switch (values.kind) {
    case 'hero':
      return { ...base, image_path: values.imagePath };
    case 'split':
      return { ...base, image_path: values.imagePath, image_path_2: values.imagePath2 };
    case 'collection':
      return { ...base, category_id: values.categoryId || null, product_ids: values.productIds };
    case 'lookbook':
      return {
        ...base,
        items: values.items.map((item) => ({
          image_path: item.imagePath,
          caption: item.caption,
          href: item.href,
        })),
      };
  }
}

export type SaveSectionInput = {
  id: string;
  isNew: boolean;
  values: SectionValues;
  isActive: boolean;
  /** Sort for a new section (end of the list). */
  sort: number;
  /** Paths the stored row referenced; those no longer used are removed (own folder only). */
  previousPaths: string[];
};

export async function saveSection(input: SaveSectionInput): Promise<void> {
  const row = { ...sectionColumns(input.values), is_active: input.isActive };
  const { error } = input.isNew
    ? await supabase.from('home_sections').insert({ ...row, id: input.id, sort: input.sort })
    : await supabase.from('home_sections').update(row).eq('id', input.id);
  if (error) throw error;
  const kept = new Set(sectionImagePaths(row));
  const dropped = input.previousPaths.filter((path) => !kept.has(path));
  if (dropped.length) await removeOwnedImages(dropped, input.id).catch(() => undefined);
}

export async function setSectionActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('home_sections')
    .update({ is_active: isActive })
    .eq('id', id);
  if (error) throw error;
}

/** Writes sort = position for every section whose sort changes. */
export async function reorderSections(ordered: { id: string; sort: number }[]): Promise<void> {
  const changed = ordered.flatMap((item, index) =>
    item.sort === index ? [] : [{ ...item, index }],
  );
  const results = await Promise.all(
    changed.map((item) =>
      supabase.from('home_sections').update({ sort: item.index }).eq('id', item.id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

/** Deletes a section, then the images it uploaded into its own folder. */
export async function deleteSection(section: HomeSectionRow): Promise<void> {
  const { error } = await supabase.from('home_sections').delete().eq('id', section.id);
  if (error) throw error;
  await removeOwnedImages(sectionImagePaths(section), section.id).catch(() => undefined);
}

export type PickedProduct = {
  id: string;
  name: string;
  status: ProductStatus;
  imagePath: string | null;
};

const PICK_COLUMNS = 'id, name, status, images:product_images(storage_path, sort)';

type PickRow = {
  id: string;
  name: string;
  status: ProductStatus;
  images: { storage_path: string; sort: number }[];
};

const toPicked = (row: PickRow): PickedProduct => ({
  id: row.id,
  name: row.name,
  status: row.status,
  imagePath: [...row.images].sort((a, b) => a.sort - b.sort)[0]?.storage_path ?? null,
});

/** Products for a collection picker, matched by name or slug (10 newest). */
export async function searchPickableProducts(q: string): Promise<PickedProduct[]> {
  const term = adminSearchTerm(q);
  let query = supabase
    .from('products')
    .select(PICK_COLUMNS)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(10);
  if (term) query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data as PickRow[]).map(toPicked);
}

/** The given products in the given order (missing ids are dropped). */
export async function fetchPickedProducts(ids: string[]): Promise<PickedProduct[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('products').select(PICK_COLUMNS).in('id', ids);
  if (error) throw error;
  const rows = (data as PickRow[]).map(toPicked);
  return ids.flatMap((id) => rows.find((row) => row.id === id) ?? []);
}

// Settings ----------------------------------------------------------------------------------------

/** Updates the single site_settings row; updated_by/updated_at are set by triggers. */
export async function saveSettings(values: SettingsValues): Promise<void> {
  const { error } = await supabase
    .from('site_settings')
    .update({
      shipping_fee: values.shippingFee,
      free_shipping_threshold: values.freeShippingThreshold,
      bank_name: values.bankName,
      bank_account: values.bankAccount,
      bank_holder: values.bankHolder,
      payment_due_hours: values.paymentDueHours,
    })
    .eq('id', 1)
    .select('id')
    .single();
  if (error) throw error;
}

// Audit log ---------------------------------------------------------------------------------------

export type AuditLogRow = Tables['audit_logs']['Row'];

export const AUDIT_TABLES = [
  'orders',
  'products',
  'product_variants',
  'product_images',
  'categories',
  'home_sections',
  'site_settings',
  'profiles',
] as const;

export type AuditTable = (typeof AUDIT_TABLES)[number];

export type AuditFilters = { table: AuditTable | 'all'; page: number };

export type AuditEntry = AuditLogRow & {
  /** E-mail of the acting user; null for system jobs or deleted accounts. */
  actorEmail: string | null;
};

export async function fetchAuditLogs(
  filters: AuditFilters,
): Promise<{ items: AuditEntry[]; total: number }> {
  const from = (filters.page - 1) * ADMIN_PAGE_SIZE;
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1);
  if (filters.table !== 'all') query = query.eq('table_name', filters.table);
  const { data, error, count } = await query;
  if (error) throw error;

  const actorIds = [...new Set(data.flatMap((row) => (row.actor_id ? [row.actor_id] : [])))];
  const emails = new Map<string, string>();
  if (actorIds.length) {
    const profiles = await supabase.from('profiles').select('id, email').in('id', actorIds);
    if (profiles.error) throw profiles.error;
    for (const profile of profiles.data) emails.set(profile.id, profile.email);
  }
  return {
    total: count ?? 0,
    items: data.map((row) => ({
      ...row,
      actorEmail: row.actor_id ? (emails.get(row.actor_id) ?? null) : null,
    })),
  };
}
