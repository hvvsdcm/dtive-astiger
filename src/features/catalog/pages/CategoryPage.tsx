import { NavLink, useParams, useSearchParams } from 'react-router';
import { NotFoundPage } from '@/app/NotFoundPage';
import { pageTitle } from '@/config/site';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterBar } from '../components/FilterBar';
import { ProductGrid } from '../components/ProductGrid';
import { useCategoryScope, useFacets, useProductList } from '../hooks';
import { buildCategoryTree, isLatinLabel, parseListParams } from '../model';

const subNavLink = ({ isActive }: { isActive: boolean }) =>
  cn('text-sm underline-offset-4 hover:underline', isActive && 'underline');

/** `/shop` (every category) and `/shop/:categorySlug` (a category and its children). */
export function CategoryPage() {
  const { categorySlug } = useParams();
  const [params, setParams] = useSearchParams();
  const { size, color, sort } = parseListParams(params);
  const categories = useCategoryScope(categorySlug);
  const scope = categories.scope;
  const ready = !categorySlug || Boolean(scope);
  const categoryIds = scope?.ids;

  const list = useProductList({ categoryIds, size, color, sort }, ready);
  const facets = useFacets(categoryIds, ready);

  if (categorySlug && scope === null) return <NotFoundPage />;

  const title = scope?.category.name ?? '전체';
  const subNav = scope
    ? [
        { label: '전체', href: `/shop/${scope.root.slug}` },
        ...scope.root.children.map((c) => ({ label: c.name, href: `/shop/${c.slug}` })),
      ]
    : buildCategoryTree(categories.all ?? []).map((c) => ({
        label: c.name,
        href: `/shop/${c.slug}`,
      }));

  const products = list.data?.pages.flatMap((page) => page.items) ?? [];
  const total = list.data?.pages[0]?.total;
  const filtered = Boolean(size || color);
  const failed = categories.isError || list.isError;

  return (
    <div className="px-gutter pt-10 pb-16 lg:pt-16 lg:pb-24">
      <title>{pageTitle(title)}</title>
      <header className="flex flex-col gap-4">
        <h1 className={isLatinLabel(title) ? 'font-display text-2xl' : 'text-xl'}>{title}</h1>
        {subNav.length > 1 || !scope ? (
          <nav aria-label="하위 카테고리">
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {subNav.map((item) => (
                <li key={item.href}>
                  <NavLink to={item.href} end className={subNavLink}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      <div className="mt-6">
        <FilterBar
          sizes={facets.data?.sizes ?? []}
          colors={facets.data?.colors ?? []}
          total={total}
        />
      </div>

      <div className="pt-6">
        {failed ? (
          <ErrorState
            onRetry={() => {
              void categories.refetch();
              void list.refetch();
            }}
          />
        ) : !list.isPending && products.length === 0 ? (
          <EmptyState
            title="해당하는 상품이 없습니다"
            action={
              filtered
                ? {
                    label: '필터 초기화',
                    onClick: () =>
                      setParams(
                        (current) => {
                          const next = new URLSearchParams(current);
                          next.delete('size');
                          next.delete('color');
                          return next;
                        },
                        { replace: true },
                      ),
                  }
                : undefined
            }
          />
        ) : (
          <ProductGrid
            products={products}
            loadingCount={list.isPending ? 8 : list.isFetchingNextPage ? 4 : 0}
          />
        )}

        {list.hasNextPage ? (
          <div className="mt-12 flex justify-center">
            <Button
              variant="secondary"
              loading={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
              className="min-w-40"
            >
              더 보기
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
