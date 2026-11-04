import {
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import type { NavItem } from '@/config/site';
import { toast } from '@/components/ui/toastStore';
import { useSession } from '@/features/auth/session';
import { useCart } from '@/features/cart/store';
import { qk } from '@/lib/queryKeys';
import { rpcErrorMessage } from '@/lib/rpcErrors';
import {
  addToWishlist,
  fetchCategories,
  fetchCollection,
  fetchFacets,
  fetchHomeSections,
  fetchProduct,
  fetchProducts,
  fetchWishlist,
  removeFromWishlist,
  type HomeSection,
  type WishlistEntry,
} from './api';
import {
  PAGE_SIZE,
  buildCategoryTree,
  imagesForColor,
  resolveCategory,
  type ProductCardData,
  type ProductCardVariant,
  type ProductFilters,
} from './model';

const categoriesQuery = queryOptions({
  queryKey: qk.categories,
  queryFn: fetchCategories,
  staleTime: 5 * 60_000,
});

export const homeSectionsQuery = queryOptions({
  queryKey: qk.homeSections,
  queryFn: fetchHomeSections,
});

const useCategories = () => useQuery(categoriesQuery);

export type CatalogNavItem = NavItem & { imagePath?: string | null; children?: CatalogNavItem[] };

/** First-level store menu: active root categories (max five) with children, then Lookbook. */
export function useStoreNav(): { nav: CatalogNavItem[] | null; failed: boolean } {
  const { data, isError } = useCategories();
  if (!data) return { nav: null, failed: isError };
  const roots = buildCategoryTree(data)
    .slice(0, 5)
    .map((root) => ({
      label: root.name,
      href: `/shop/${root.slug}`,
      imagePath: root.imagePath,
      children: root.children.map((child) => ({
        label: child.name,
        href: `/shop/${child.slug}`,
        imagePath: child.imagePath,
      })),
    }));
  return { nav: [...roots, { label: 'Lookbook', href: '/lookbook' }], failed: false };
}

/** Category for `/shop/:slug`: undefined while loading, null when unknown. */
export function useCategoryScope(slug: string | undefined) {
  const query = useCategories();
  if (!slug) return { ...query, scope: undefined, all: query.data };
  const scope = query.data ? resolveCategory(query.data, slug) : undefined;
  return { ...query, scope, all: query.data };
}

/** Paged product list ("더 보기"). Disabled until `enabled` (category resolved / search term). */
export function useProductList(filters: ProductFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.products(filters),
    queryFn: ({ pageParam }) => fetchProducts(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      pages.length * PAGE_SIZE < last.total ? pages.length : undefined,
    enabled,
  });
}

export function useFacets(categoryIds: string[] | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.products({ facets: categoryIds ?? 'all' }),
    queryFn: () => fetchFacets(categoryIds),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useProduct(slug: string) {
  return useQuery({ queryKey: qk.product(slug), queryFn: () => fetchProduct(slug) });
}

export function useHomeSections() {
  return useQuery(homeSectionsQuery);
}

/** Products of a home collection section (picked ids, else its category and children). */
export function useCollection(section: HomeSection) {
  const categories = useCategories();
  const needsCategory = section.productIds.length === 0;
  const scopeIds = (() => {
    if (!needsCategory) return null;
    if (!section.categoryId || !categories.data) return null;
    const category = categories.data.find((c) => c.id === section.categoryId);
    return category ? (resolveCategory(categories.data, category.slug)?.ids ?? null) : [];
  })();
  return useQuery({
    queryKey: qk.products({ section: section.id, ids: section.productIds, scope: scopeIds }),
    queryFn: () => fetchCollection(section.productIds, scopeIds),
    enabled: !needsCategory || !section.categoryId || Boolean(categories.data),
  });
}

/** Adds one unit of a variant to the cart and confirms with a toast (the drawer stays closed). */
export function addProductToCart(product: ProductCardData, variant: ProductCardVariant) {
  const image = imagesForColor(product.images, variant.color)[0];
  useCart.getState().add({
    variantId: variant.id,
    productId: product.id,
    slug: product.slug,
    name: product.name,
    color: variant.color,
    size: variant.size,
    unitPrice: product.price + variant.priceDelta,
    imagePath: image?.path ?? null,
    stock: variant.stock,
  });
  toast('장바구니에 담았습니다');
}

/**
 * The signed-in user's wishlist. `toggle` sends signed-out visitors to the login page and comes
 * back to the current URL afterwards.
 */
export function useWishlist() {
  const { user, loading } = useSession();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const key = qk.wishlist(userId);

  const query = useQuery({
    queryKey: key,
    queryFn: fetchWishlist,
    enabled: Boolean(userId),
  });

  const mutation = useMutation({
    mutationFn: ({ productId, wished }: { productId: string; wished: boolean }) =>
      userId
        ? wished
          ? removeFromWishlist(userId, productId)
          : addToWishlist(userId, productId)
        : Promise.resolve(),
    onMutate: async ({ productId, wished }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<WishlistEntry[]>(key);
      queryClient.setQueryData<WishlistEntry[]>(key, (entries = []) =>
        wished
          ? entries.filter((entry) => entry.productId !== productId)
          : [{ productId, product: null }, ...entries],
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      queryClient.setQueryData(key, context?.previous);
      toast(rpcErrorMessage(error), 'error');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const ids = new Set((query.data ?? []).map((entry) => entry.productId));

  function toggle(productId: string) {
    if (loading) return;
    if (!userId) {
      const next = `${location.pathname}${location.search}`;
      void navigate(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    mutation.mutate({ productId, wished: ids.has(productId) });
  }

  return { ...query, ids, toggle, signedIn: Boolean(userId) };
}
