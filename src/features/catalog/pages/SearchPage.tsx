import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { pageTitle } from '@/config/site';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { ProductGrid } from '../components/ProductGrid';
import { useProductList } from '../hooks';
import { searchTerm } from '../model';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('q') ?? '';
  const term = searchTerm(raw);
  const list = useProductList({ q: term }, term !== '');
  const products = list.data?.pages.flatMap((page) => page.items) ?? [];
  const total = list.data?.pages[0]?.total;

  return (
    <div className="px-gutter pt-10 pb-16 lg:pt-16 lg:pb-24">
      <title>{pageTitle(raw ? `'${raw}' 검색` : '검색')}</title>
      <h1 className="sr-only">검색</h1>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get('q')?.toString().trim() ?? '';
          setParams(value ? { q: value } : {});
        }}
        className="flex items-center gap-2 border-b border-ink"
      >
        <label htmlFor="search-page-q" className="sr-only">
          검색어
        </label>
        <input
          key={raw}
          id="search-page-q"
          name="q"
          type="search"
          defaultValue={raw}
          maxLength={50}
          autoComplete="off"
          enterKeyHint="search"
          className="h-14 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
          placeholder="검색"
        />
        <button
          type="submit"
          aria-label="검색"
          className="inline-flex size-10 items-center justify-center"
        >
          <Icon icon={Search} />
        </button>
      </form>

      <p className="h-12 pt-4 text-xs text-ink-muted" aria-live="polite">
        {term && total !== undefined && total > 0 ? `${total.toLocaleString('ko-KR')}개` : ''}
      </p>

      {!raw.trim() ? null : term && list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : !term || (!list.isPending && products.length === 0) ? (
        <EmptyState title={`'${raw}'에 대한 결과가 없습니다`} />
      ) : (
        <ProductGrid
          products={products}
          loadingCount={list.isPending ? 8 : list.isFetchingNextPage ? 4 : 0}
        />
      )}

      {term && list.hasNextPage ? (
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
  );
}
