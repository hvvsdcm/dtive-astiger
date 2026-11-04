import { Heart } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { NotFoundPage } from '@/app/NotFoundPage';
import { business } from '@/config/business';
import { pageTitle } from '@/config/site';
import { Accordion, type AccordionItem } from '@/components/ui/Accordion';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatKRW } from '@/lib/format';
import type { ProductDetail } from '../api';
import { ImageGallery } from '../components/ImageGallery';
import { VariantPicker } from '../components/VariantPicker';
import { addProductToCart, useProduct, useWishlist } from '../hooks';
import { activeVariants, compareSizes, imagesForColor, productColors } from '../model';

export function ProductPage() {
  const { slug = '' } = useParams();
  const { data: product, isPending, isError, refetch } = useProduct(slug);

  if (isPending) return <ProductSkeleton />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (!product) return <NotFoundPage />;
  return <ProductView key={product.id} product={product} />;
}

function ProductView({ product }: { product: ProductDetail }) {
  const [params, setParams] = useSearchParams();
  const wishlist = useWishlist();
  const wished = wishlist.ids.has(product.id);
  const variants = activeVariants(product);
  const colors = productColors(product);
  const firstImageColor = product.images[0]?.color;
  const defaultColor =
    firstImageColor && colors.includes(firstImageColor) ? firstImageColor : colors[0];
  const paramColor = params.get('color');
  const color = paramColor && colors.includes(paramColor) ? paramColor : defaultColor;
  const sizes = variants
    .filter((v) => v.color === color)
    .sort((a, b) => compareSizes(a.size, b.size));
  const inStock = sizes.filter((v) => v.stock > 0);

  const [pickedId, setPickedId] = useState<string | undefined>();
  const [sizeError, setSizeError] = useState(false);
  const sizeErrorId = useId();
  const pickerRef = useRef<HTMLDivElement>(null);
  // A single size in stock (e.g. ONE SIZE) needs no choice.
  const selected =
    sizes.find((v) => v.id === pickedId && v.stock > 0) ??
    (sizes.length === 1 && inStock.length === 1 ? inStock[0] : undefined);
  const price = product.price + (selected?.priceDelta ?? 0);
  const soldOut = inStock.length === 0;

  const gallery = imagesForColor(product.images, color ?? null).map((image) => ({
    path: image.path,
    alt: product.imagesAlt[image.path] || product.name,
  }));

  function changeColor(next: string) {
    const sameSize = variants.find(
      (v) => v.color === next && v.size === selected?.size && v.stock > 0,
    );
    setPickedId(sameSize?.id);
    setSizeError(false);
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next === defaultColor) updated.delete('color');
        else updated.set('color', next);
        return updated;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  function addToCart() {
    if (!selected) {
      setSizeError(true);
      pickerRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    addProductToCart(product, selected);
  }

  const priceLine = (
    <p className="text-sm">
      {product.compareAtPrice ? (
        <s className="mr-2 text-ink-muted">{formatKRW(product.compareAtPrice)}</s>
      ) : null}
      {formatKRW(price)}
    </p>
  );

  const details: AccordionItem[] = [];
  if (product.description) {
    details.push({ id: 'detail', title: '상세', content: product.description });
  }
  if (product.material || product.care) {
    details.push({
      id: 'material',
      title: '소재·세탁',
      content: [product.material, product.care].filter(Boolean).join('\n\n'),
    });
  }
  details.push({
    id: 'shipping',
    title: '배송·교환·반품',
    content: `${business.shippingPolicy}\n\n${business.returnPolicy}`,
  });

  return (
    <div>
      <title>{pageTitle(product.name)}</title>
      <div className="lg:grid lg:grid-cols-[3fr_2fr]">
        <ImageGallery key={color} images={gallery} label={`${product.name} 사진`} />

        <div className="px-gutter pt-6 pb-12 lg:pt-0 lg:pb-24">
          <div className="flex flex-col gap-8 lg:sticky lg:top-header-lg lg:mx-auto lg:max-w-[440px] lg:pt-10">
            <div className="flex flex-col gap-1">
              <h1 className="text-md">{product.name}</h1>
              {priceLine}
            </div>

            <div ref={pickerRef}>
              <VariantPicker
                colors={colors}
                color={color}
                onColorChange={changeColor}
                sizes={sizes}
                variantId={selected?.id}
                onVariantChange={(id) => {
                  setPickedId(id);
                  setSizeError(false);
                }}
                sizeError={sizeError}
                sizeErrorId={sizeErrorId}
              />
            </div>

            <div className="flex flex-col gap-3">
              <Button fullWidth disabled={soldOut} onClick={addToCart} className="max-lg:hidden">
                {soldOut ? '품절' : '장바구니 담기'}
              </Button>
              <button
                type="button"
                aria-pressed={wished}
                onClick={() => wishlist.toggle(product.id)}
                className="inline-flex h-10 items-center gap-2 self-start text-sm"
              >
                <Icon icon={Heart} size={16} fill={wished ? 'currentColor' : 'none'} />
                {wished ? '위시리스트에 담김' : '위시리스트'}
              </button>
            </div>

            <Accordion items={details} defaultOpen={['detail']} />
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-30 flex items-center justify-between gap-4 border-t border-line bg-bg px-4 py-3 lg:hidden">
        {priceLine}
        <Button disabled={soldOut} onClick={addToCart} className="min-w-40">
          {soldOut ? '품절' : '장바구니 담기'}
        </Button>
      </div>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div aria-busy="true" className="lg:grid lg:grid-cols-[3fr_2fr]">
      <Skeleton className="aspect-[3/4] w-full" />
      <div className="flex flex-col gap-3 px-gutter pt-6 lg:mx-auto lg:w-full lg:max-w-[440px] lg:pt-10">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-5 w-1/4" />
        <Skeleton className="mt-6 h-11 w-full" />
      </div>
    </div>
  );
}
