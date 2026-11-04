/**
 * Catalog types and pure helpers (no Supabase access) shared by the catalog API, pages and cards.
 */

export type ProductCardImage = { path: string; color: string | null; sort: number };

export type ProductCardVariant = {
  id: string;
  color: string;
  size: string;
  stock: number;
  isActive: boolean;
  priceDelta: number;
};

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  images: ProductCardImage[];
  variants: ProductCardVariant[];
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  imagePath: string | null;
  sort: number;
};

export type CategoryNode = Category & { children: Category[] };

export type ProductSort = 'new' | 'price_asc' | 'price_desc';

export const PRODUCT_SORTS: { value: ProductSort; label: string }[] = [
  { value: 'new', label: '최신순' },
  { value: 'price_asc', label: '낮은 가격순' },
  { value: 'price_desc', label: '높은 가격순' },
];

export type ProductFilters = {
  /** Category ids to include (a category and its children). Omit for every category. */
  categoryIds?: string[];
  size?: string;
  color?: string;
  sort?: ProductSort;
  q?: string;
};

export const PAGE_SIZE = 24;

/** Reads `?size=&color=&sort=` from the URL; unknown sort values fall back to newest. */
export function parseListParams(params: URLSearchParams): {
  size?: string;
  color?: string;
  sort: ProductSort;
} {
  const sortParam = params.get('sort');
  const sort = PRODUCT_SORTS.some((s) => s.value === sortParam)
    ? (sortParam as ProductSort)
    : 'new';
  const size = params.get('size')?.trim() || undefined;
  const color = params.get('color')?.trim() || undefined;
  return { size, color, sort };
}

/**
 * Turns user input into a term that is safe inside a PostgREST `or=(…ilike…)` filter: drops the
 * characters that delimit the filter or act as LIKE wildcards, collapses whitespace, caps length.
 */
export function searchTerm(raw: string | null | undefined): string {
  return (raw ?? '')
    .replace(/[%_*,()"'\\.:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);
}

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

/** Clothing sizes in wearing order, numbers ascending, anything else alphabetically after. */
export function compareSizes(a: string, b: string): number {
  const rank = (size: string) => {
    const index = SIZE_ORDER.indexOf(size.toUpperCase());
    if (index >= 0) return [0, index] as const;
    const n = Number(size);
    if (Number.isFinite(n)) return [1, n] as const;
    return [2, 0] as const;
  };
  const [ga, va] = rank(a);
  const [gb, vb] = rank(b);
  if (ga !== gb) return ga - gb;
  if (va !== vb) return va - vb;
  return a.localeCompare(b);
}

export function uniqueSorted(values: string[], compare?: (a: string, b: string) => number) {
  return [...new Set(values.filter(Boolean))].sort(compare);
}

/** Roots in `sort` order with their direct children (two levels, as in the admin). */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const bySort = [...categories].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  return bySort
    .filter((c) => c.parentId === null)
    .map((root) => ({ ...root, children: bySort.filter((c) => c.parentId === root.id) }));
}

/** The category with this slug plus its children; null when the slug is unknown or inactive. */
export function resolveCategory(
  categories: Category[],
  slug: string,
): { category: Category; root: CategoryNode; ids: string[] } | null {
  const category = categories.find((c) => c.slug === slug);
  if (!category) return null;
  const tree = buildCategoryTree(categories);
  const root =
    tree.find((node) => node.id === category.id) ??
    tree.find((node) => node.id === category.parentId);
  if (!root) return null;
  const ids =
    category.parentId === null ? [category.id, ...root.children.map((c) => c.id)] : [category.id];
  return { category, root, ids };
}

export const activeVariants = (product: ProductCardData) =>
  product.variants.filter((v) => v.isActive);

export const isSoldOut = (product: ProductCardData) =>
  activeVariants(product).every((v) => v.stock < 1);

/** Colours in variant `sort` order, each once. */
export const productColors = (product: ProductCardData) => [
  ...new Set(activeVariants(product).map((v) => v.color)),
];

/** Images for a colour: tagged with it or untagged; every image when none match. */
export function imagesForColor(images: ProductCardImage[], color: string | null) {
  const sorted = [...images].sort((a, b) => a.sort - b.sort);
  if (!color) return sorted;
  const matching = sorted.filter((image) => image.color === color || image.color === null);
  return matching.some((image) => image.color === color) ? matching : sorted;
}

/** Latin-only labels get the uppercase tracking style; Korean labels never do. */
export const isLatinLabel = (label: string) => /^[\x20-\x7E]+$/.test(label);
