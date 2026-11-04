import { business } from '@/config/business';
import { pageTitle } from '@/config/site';
import { cn } from '@/components/ui/cn';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { HomeSection } from '../components/HomeSection';
import { ProductGrid } from '../components/ProductGrid';
import { useHomeSections, useProductList } from '../hooks';

/** Active home sections in order; every product when none are active. */
export function HomePage() {
  const { data, isPending, isError, refetch } = useHomeSections();
  const startsWithHero = data?.[0]?.kind === 'hero';

  return (
    <div
      className={cn(
        'flex flex-col gap-16 pb-16 lg:gap-24 lg:pb-24',
        !startsWithHero && 'pt-10 lg:pt-16',
      )}
    >
      <title>{pageTitle()}</title>
      <h1 className="sr-only">{business.brandName}</h1>
      {isPending ? (
        <Skeleton className="h-svh min-h-[560px] w-full" />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <AllProducts />
      ) : (
        data.map((section, index) => (
          <HomeSection key={section.id} section={section} first={index === 0} />
        ))
      )}
    </div>
  );
}

function AllProducts() {
  const list = useProductList({});
  if (list.isError) return <ErrorState onRetry={() => void list.refetch()} />;
  return (
    <div className="px-gutter">
      <ProductGrid
        products={list.data?.pages[0]?.items ?? []}
        loadingCount={list.isPending ? 8 : 0}
      />
    </div>
  );
}
