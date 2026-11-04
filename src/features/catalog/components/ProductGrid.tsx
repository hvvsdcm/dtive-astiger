import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/Skeleton';
import type { ProductCardData } from '../model';
import { ProductCard } from './ProductCard';

/** 2 / 3 / 4 columns (<768 / 768–1279 / ≥1280), 8px column gap, 32px row gap. */
export const GRID_CLASS = 'grid grid-cols-2 gap-x-2 gap-y-8 md:grid-cols-3 xl:grid-cols-4';

export type ProductGridProps = {
  products: ProductCardData[];
  /** Skeleton cards appended while the next page loads (or shown alone on first load). */
  loadingCount?: number;
  /** Grid layout classes; defaults to GRID_CLASS. */
  gridClassName?: string;
  imageSizes?: string;
  /** Cards that are hidden at some widths (e.g. home collections) get per-index classes. */
  itemClassName?: (index: number) => string | undefined;
};

export function ProductGrid({
  products,
  loadingCount = 0,
  gridClassName = GRID_CLASS,
  imageSizes,
  itemClassName,
}: ProductGridProps) {
  return (
    <ul className={gridClassName}>
      {products.map((product, index) => (
        <li key={product.id} className={itemClassName?.(index)}>
          <ProductCard product={product} imageSizes={imageSizes} eager={index < 4} />
        </li>
      ))}
      {Array.from({ length: loadingCount }, (_, index) => (
        <li key={`skeleton-${index}`} aria-hidden="true" className={itemClassName?.(index)}>
          <ProductCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      <Skeleton className="aspect-[3/4] w-full" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-1 h-4 w-1/3" />
    </div>
  );
}
