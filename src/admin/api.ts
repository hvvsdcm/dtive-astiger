import { z } from 'zod';
import { searchTerm } from '@/features/catalog/model';
import { storageKey, type StorageBucket } from '@/lib/images';
import { imageResize } from '@/lib/imageResize';
import { rpcErrorMessage } from '@/lib/rpcErrors';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { ProductStatus } from '@/types/domain';
import type { CategoryValues, ProductValues, VariantRowValues } from './schemas';

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
