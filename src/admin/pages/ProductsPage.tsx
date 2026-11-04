import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { pageTitle } from '@/config/site';
import { formatDate, formatKRW } from '@/lib/format';
import { imageUrl } from '@/lib/images';
import { qk } from '@/lib/queryKeys';
import { PRODUCT_STATUSES, PRODUCT_STATUS_LABEL, type ProductStatus } from '@/types/domain';
import {
  ADMIN_PAGE_SIZE,
  ADMIN_PRODUCT_SORTS,
  fetchAdminProducts,
  type AdminProductFilters,
  type AdminProductListItem,
  type AdminProductSort,
} from '../api';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';

type StatusFilter = ProductStatus | 'all';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  ...PRODUCT_STATUSES.map((status) => ({ value: status, label: PRODUCT_STATUS_LABEL[status] })),
];

function readFilters(params: URLSearchParams): AdminProductFilters {
  const status = params.get('status');
  const sort = params.get('sort');
  const page = Number(params.get('page'));
  return {
    q: params.get('q') ?? '',
    status: STATUS_TABS.some((tab) => tab.value === status) ? (status as StatusFilter) : 'all',
    sort: ADMIN_PRODUCT_SORTS.some((s) => s.value === sort)
      ? (sort as AdminProductSort)
      : 'updated',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

const columns: Column<AdminProductListItem>[] = [
  {
    key: 'image',
    header: <span className="sr-only">이미지</span>,
    className: 'w-14',
    cell: (row) =>
      row.imagePath ? (
        <img
          src={imageUrl(row.imagePath, 'm')}
          alt=""
          loading="lazy"
          className="h-[53px] w-10 max-w-none bg-surface object-cover"
        />
      ) : (
        <div className="h-[53px] w-10 bg-surface" />
      ),
  },
  {
    key: 'name',
    header: '상품명',
    className: 'min-w-56',
    cell: (row) => (
      <Link to={`/admin/products/${row.id}`} className="flex flex-col hover:underline">
        <span>{row.name}</span>
        <span className="text-2xs text-ink-muted">{row.slug}</span>
      </Link>
    ),
  },
  {
    key: 'category',
    header: '카테고리',
    cell: (row) => row.categoryName ?? <span className="text-ink-muted">미분류</span>,
  },
  {
    key: 'price',
    header: '가격',
    className: 'text-right tabular-nums',
    cell: (row) => (
      <span className="flex flex-col items-end">
        {formatKRW(row.price)}
        {row.compareAtPrice ? (
          <span className="text-2xs text-ink-muted line-through">
            {formatKRW(row.compareAtPrice)}
          </span>
        ) : null}
      </span>
    ),
  },
  {
    key: 'stock',
    header: '재고',
    className: 'text-right tabular-nums',
    cell: (row) => (
      <span className={row.totalStock === 0 ? 'text-danger' : undefined}>
        {row.totalStock === 0 ? '품절' : row.totalStock}
      </span>
    ),
  },
  { key: 'status', header: '상태', cell: (row) => <StatusBadge status={row.status} /> },
  {
    key: 'updated',
    header: '수정일',
    className: 'tabular-nums text-ink-muted',
    cell: (row) => formatDate(row.updatedAt),
  },
];

export function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const [search, setSearch] = useState(filters.q);

  const products = useQuery({
    queryKey: qk.admin.products(filters),
    queryFn: () => fetchAdminProducts(filters),
    placeholderData: keepPreviousData,
  });

  function setFilter(patch: Partial<AdminProductFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const entries: [string, string][] = [];
    if (next.q) entries.push(['q', next.q]);
    if (next.status !== 'all') entries.push(['status', next.status]);
    if (next.sort !== 'updated') entries.push(['sort', next.sort]);
    if (next.page > 1) entries.push(['page', String(next.page)]);
    setParams(new URLSearchParams(entries));
  }

  const pageCount = Math.ceil((products.data?.total ?? 0) / ADMIN_PAGE_SIZE);

  return (
    <>
      <title>{pageTitle('상품 관리')}</title>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-lg font-medium">
          상품
          {products.data ? (
            <span className="ml-2 text-sm font-normal text-ink-muted tabular-nums">
              {products.data.total}
            </span>
          ) : null}
        </h1>
        <ButtonLink to="/admin/products/new" size="sm">
          상품 추가
        </ButtonLink>
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <Tabs
          label="상태"
          items={STATUS_TABS}
          value={filters.status}
          onChange={(status) => setFilter({ status })}
        />
        <div className="flex gap-2">
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              setFilter({ q: search.trim() });
            }}
            className="relative flex-1 md:w-64"
          >
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="상품명, 슬러그"
              aria-label="상품 검색"
              className="pr-10"
            />
            <button
              type="submit"
              aria-label="검색"
              className="absolute top-0 right-0 inline-flex size-11 items-center justify-center"
            >
              <Icon icon={Search} size={18} />
            </button>
          </form>
          <Select
            aria-label="정렬"
            value={filters.sort}
            onChange={(event) => setFilter({ sort: event.target.value as AdminProductSort })}
            className="w-36 shrink-0"
          >
            {ADMIN_PRODUCT_SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <DataTable
        label="상품 목록"
        columns={columns}
        rows={products.data?.items}
        rowKey={(row) => row.id}
        loading={products.isPending}
        error={products.isError}
        onRetry={() => void products.refetch()}
      />
      <Pagination
        page={filters.page}
        pageCount={pageCount}
        onChange={(page) => setFilter({ page })}
        className="mt-6"
      />
    </>
  );
}
