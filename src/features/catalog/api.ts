import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import {
  PAGE_SIZE,
  compareSizes,
  searchTerm,
  uniqueSorted,
  type Category,
  type ProductCardData,
  type ProductFilters,
} from './model';

type Tables = Database['public']['Tables'];
type HomeSectionRow = Tables['home_sections']['Row'];

/** Columns a product card needs. `images`/`variants` are aliases used by the mapper below. */
const VARIANT_COLUMNS =
  'variants:product_variants(id, color, size, stock, is_active, price_delta, sort)';
const CARD_COLUMNS = `id, slug, name, price, compare_at_price, images:product_images(storage_path, color, sort), ${VARIANT_COLUMNS}`;
const DETAIL_COLUMNS = `id, slug, name, price, compare_at_price, description, material, care, images:product_images(storage_path, color, sort, alt), ${VARIANT_COLUMNS}, category:categories(slug, name)`;

type CardRow = Pick<
  Tables['products']['Row'],
  'id' | 'slug' | 'name' | 'price' | 'compare_at_price'
> & {
  images: Pick<Tables['product_images']['Row'], 'storage_path' | 'color' | 'sort'>[];
  variants: Pick<
    Tables['product_variants']['Row'],
    'id' | 'color' | 'size' | 'stock' | 'is_active' | 'price_delta' | 'sort'
  >[];
};

function toCard(row: CardRow): ProductCardData {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: row.price,
    compareAtPrice: row.compare_at_price,
    images: [...row.images]
      .sort((a, b) => a.sort - b.sort)
      .map((image) => ({ path: image.storage_path, color: image.color, sort: image.sort })),
    variants: [...row.variants]
      .sort((a, b) => a.sort - b.sort)
      .map((v) => ({
        id: v.id,
        color: v.color,
        size: v.size,
        stock: v.stock,
        isActive: v.is_active,
        priceDelta: v.price_delta,
      })),
  };
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, slug, name, parent_id, image_path, sort')
    .eq('is_active', true)
    .order('sort');
  if (error) throw error;
  return data.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    parentId: c.parent_id,
    imagePath: c.image_path,
    sort: c.sort,
  }));
}

export type ProductPage = { items: ProductCardData[]; total: number };

/**
 * One page of active products. Size/colour filters match an active, in-stock variant that has
 * both values (a second, inner-joined embed so the card still receives every variant).
 */
export async function fetchProducts(filters: ProductFilters, page: number): Promise<ProductPage> {
  const filtered = Boolean(filters.size || filters.color);
  const columns = filtered ? `${CARD_COLUMNS}, match:product_variants!inner(id)` : CARD_COLUMNS;
  let query = supabase.from('products').select(columns, { count: 'exact' }).eq('status', 'active');

  if (filters.categoryIds) query = query.in('category_id', filters.categoryIds);
  if (filtered) query = query.eq('match.is_active', true).gt('match.stock', 0);
  if (filters.size) query = query.eq('match.size', filters.size);
  if (filters.color) query = query.eq('match.color', filters.color);
  const term = searchTerm(filters.q);
  if (filters.q !== undefined) {
    query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  }

  if (filters.sort === 'price_asc') query = query.order('price', { ascending: true });
  else if (filters.sort === 'price_desc') query = query.order('price', { ascending: false });
  else query = query.order('published_at', { ascending: false, nullsFirst: false });
  query = query.order('created_at', { ascending: false }).order('id');

  const from = page * PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return { items: (data as unknown as CardRow[]).map(toCard), total: count ?? 0 };
}

/** Products for a home collection: the picked ids in their order, else the newest of a category. */
export async function fetchCollection(
  productIds: string[],
  categoryIds: string[] | null,
  limit = 8,
): Promise<ProductCardData[]> {
  let query = supabase.from('products').select(CARD_COLUMNS).eq('status', 'active');
  if (productIds.length) query = query.in('id', productIds.slice(0, limit));
  else if (categoryIds) query = query.in('category_id', categoryIds);
  const { data, error } = await query
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const cards = (data as unknown as CardRow[]).map(toCard);
  if (!productIds.length) return cards;
  return productIds.flatMap((id) => cards.find((card) => card.id === id) ?? []);
}

/** Sizes and colours offered by active variants of the given categories (filter options). */
export async function fetchFacets(
  categoryIds: string[] | undefined,
): Promise<{ sizes: string[]; colors: string[] }> {
  let query = supabase
    .from('products')
    .select('variants:product_variants(size, color, is_active)')
    .eq('status', 'active');
  if (categoryIds) query = query.in('category_id', categoryIds);
  const { data, error } = await query;
  if (error) throw error;
  const variants = data.flatMap((p) => p.variants).filter((v) => v.is_active);
  return {
    sizes: uniqueSorted(
      variants.map((v) => v.size),
      compareSizes,
    ),
    colors: uniqueSorted(variants.map((v) => v.color)),
  };
}

export type ProductDetail = ProductCardData & {
  description: string;
  material: string;
  care: string;
  imagesAlt: Record<string, string>;
  category: { slug: string; name: string } | null;
};

/** Active product by slug; null when missing, draft or archived. */
export async function fetchProduct(slug: string): Promise<ProductDetail | null> {
  const { data, error } = await supabase
    .from('products')
    .select(DETAIL_COLUMNS)
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as Omit<CardRow, 'images'> & {
    images: (CardRow['images'][number] & { alt: string })[];
    description: string;
    material: string;
    care: string;
    category: { slug: string; name: string } | null;
  };
  return {
    ...toCard(row),
    description: row.description,
    material: row.material,
    care: row.care,
    imagesAlt: Object.fromEntries(row.images.map((image) => [image.storage_path, image.alt])),
    category: row.category,
  };
}

const lookbookItemSchema = z.object({
  image_path: z.string().min(1),
  caption: z.string().catch(''),
  href: z.string().catch(''),
});

type LookbookItem = { imagePath: string; caption: string; href: string };

export type HomeSection = {
  id: string;
  kind: HomeSectionRow['kind'];
  title: string;
  linkLabel: string;
  linkHref: string;
  imagePath: string | null;
  imagePath2: string | null;
  categoryId: string | null;
  productIds: string[];
  items: LookbookItem[];
};

/** Active home sections in display order. Malformed lookbook items are skipped. */
export async function fetchHomeSections(): Promise<HomeSection[]> {
  const { data, error } = await supabase
    .from('home_sections')
    .select(
      'id, kind, title, link_label, link_href, image_path, image_path_2, category_id, product_ids, items',
    )
    .eq('is_active', true)
    .order('sort');
  if (error) throw error;
  return data.map((s) => ({
    id: s.id,
    kind: s.kind,
    title: s.title,
    linkLabel: s.link_label,
    linkHref: s.link_href,
    imagePath: s.image_path,
    imagePath2: s.image_path_2,
    categoryId: s.category_id,
    productIds: s.product_ids,
    items: (Array.isArray(s.items) ? s.items : []).flatMap((item) => {
      const parsed = lookbookItemSchema.safeParse(item);
      return parsed.success
        ? [
            {
              imagePath: parsed.data.image_path,
              caption: parsed.data.caption,
              href: parsed.data.href,
            },
          ]
        : [];
    }),
  }));
}

export type WishlistEntry = { productId: string; product: ProductCardData | null };

/** The signed-in user's wishlist, newest first. `product` is null when it is no longer on sale. */
export async function fetchWishlist(): Promise<WishlistEntry[]> {
  const { data, error } = await supabase
    .from('wishlist_items')
    .select(`product_id, created_at, product:products(${CARD_COLUMNS}, status)`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = data as unknown as {
    product_id: string;
    product: (CardRow & { status: string }) | null;
  }[];
  return rows.map((row) => ({
    productId: row.product_id,
    product: row.product && row.product.status === 'active' ? toCard(row.product) : null,
  }));
}

export async function addToWishlist(userId: string, productId: string) {
  const { error } = await supabase
    .from('wishlist_items')
    .upsert({ user_id: userId, product_id: productId }, { ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeFromWishlist(userId: string, productId: string) {
  const { error } = await supabase
    .from('wishlist_items')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);
  if (error) throw error;
}
