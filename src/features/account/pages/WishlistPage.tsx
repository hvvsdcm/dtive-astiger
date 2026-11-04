import { pageTitle } from '@/config/site';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProductGrid } from '@/features/catalog/components/ProductGrid';
import { useWishlist } from '@/features/catalog/hooks';

/** `/account/wishlist` (inside the signed-in account layout). Items no longer on sale are hidden. */
export function WishlistPage() {
  const wishlist = useWishlist();
  const products = (wishlist.data ?? []).flatMap((entry) => entry.product ?? []);

  return (
    <section className="flex flex-col gap-6">
      <title>{pageTitle('위시리스트')}</title>
      <h2 className="text-md font-medium">위시리스트</h2>
      {wishlist.isError ? (
        <ErrorState onRetry={() => void wishlist.refetch()} />
      ) : !wishlist.isPending && products.length === 0 ? (
        <EmptyState
          title="위시리스트가 비어 있습니다"
          action={{ label: '쇼핑하기', to: '/shop' }}
        />
      ) : (
        <ProductGrid
          products={products}
          loadingCount={wishlist.isPending ? 3 : 0}
          gridClassName="grid grid-cols-2 gap-x-2 gap-y-8 md:grid-cols-3"
          imageSizes="(min-width: 768px) 240px, 50vw"
        />
      )}
    </section>
  );
}
