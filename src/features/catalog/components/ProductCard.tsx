import { Heart } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/components/ui/cn';
import { Icon } from '@/components/ui/Icon';
import { formatKRW } from '@/lib/format';
import { addProductToCart, useWishlist } from '../hooks';
import { activeVariants, compareSizes, isSoldOut, type ProductCardData } from '../model';
import { StorageImage } from './StorageImage';

export type ProductCardProps = {
  product: ProductCardData;
  /** Size chip handler; defaults to adding the variant to the cart with a toast. */
  onQuickAdd?: (variantId: string) => void;
  /** `sizes` for the card image; defaults to the 2/3/4-column grid. */
  imageSizes?: string;
  /** First row of a page: load the photo without lazy loading. */
  eager?: boolean;
};

const GRID_SIZES = '(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw';

export function ProductCard({
  product,
  onQuickAdd,
  imageSizes = GRID_SIZES,
  eager = false,
}: ProductCardProps) {
  const wishlist = useWishlist();
  const wished = wishlist.ids.has(product.id);
  const [first, second] = product.images;
  const soldOut = isSoldOut(product);
  const variants = activeVariants(product);
  // Quick add offers the colour shown on the card (first image), else the first variant colour.
  const cardColor =
    (first?.color && variants.some((v) => v.color === first.color) ? first.color : null) ??
    variants[0]?.color;
  const sizeVariants = variants
    .filter((v) => v.color === cardColor)
    .sort((a, b) => compareSizes(a.size, b.size));
  const href = `/products/${product.slug}`;

  return (
    <article className="group relative">
      <Link to={href} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-surface">
          <StorageImage
            path={first?.path ?? null}
            alt={product.name}
            sizes={imageSizes}
            eager={eager}
            className="absolute inset-0 size-full"
          />
          {second ? (
            <StorageImage
              path={second.path}
              alt=""
              sizes={imageSizes}
              className="absolute inset-0 size-full opacity-0 transition-opacity duration-400 group-hover:opacity-100"
            />
          ) : null}
        </div>
        <div className="pt-3 text-sm">
          <div className="flex gap-2">
            <h3 className="min-w-0 truncate">{product.name}</h3>
            {soldOut ? <span className="shrink-0 text-ink-muted">품절</span> : null}
          </div>
          <p>
            {product.compareAtPrice ? (
              <s className="mr-2 text-ink-muted">{formatKRW(product.compareAtPrice)}</s>
            ) : null}
            {formatKRW(product.price)}
          </p>
        </div>
      </Link>

      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[3/4]">
        <button
          type="button"
          aria-pressed={wished}
          aria-label={wished ? '위시리스트에서 삭제' : '위시리스트에 추가'}
          onClick={() => wishlist.toggle(product.id)}
          className={cn(
            'pointer-events-auto absolute top-1 right-1 inline-flex size-10 items-center justify-center transition-opacity',
            !wished && 'lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100',
          )}
        >
          <Icon icon={Heart} size={18} fill={wished ? 'currentColor' : 'none'} />
        </button>

        {!soldOut && sizeVariants.length ? (
          <div
            role="group"
            aria-label={`${product.name} 사이즈 담기`}
            className="pointer-events-auto absolute bottom-2 left-2 hidden flex-wrap gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 lg:flex"
          >
            {sizeVariants.map((variant) => {
              const out = variant.stock < 1;
              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={out}
                  aria-label={out ? `${variant.size} 품절` : `${variant.size} 장바구니에 담기`}
                  onClick={() =>
                    onQuickAdd ? onQuickAdd(variant.id) : addProductToCart(product, variant)
                  }
                  className={cn(
                    'h-7 min-w-7 bg-bg px-2 text-xs transition-colors',
                    out ? 'text-ink-muted line-through' : 'hover:bg-ink hover:text-white',
                  )}
                >
                  {variant.size}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </article>
  );
}
