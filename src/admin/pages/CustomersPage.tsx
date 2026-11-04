import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Drawer } from '@/components/ui/Drawer';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { pageTitle } from '@/config/site';
import { formatDate, formatDateTime, formatKRW } from '@/lib/format';
import { qk } from '@/lib/queryKeys';
import {
  ADMIN_PAGE_SIZE,
  CUSTOMER_RECENT_ORDERS,
  fetchAdminCustomer,
  fetchAdminCustomers,
  type AdminCustomer,
  type AdminCustomerFilters,
} from '../api';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';

const formatPhone = (phone: string | null) =>
  phone ? phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3') : '—';

function readFilters(params: URLSearchParams): AdminCustomerFilters {
  const page = Number(params.get('page'));
  return { q: params.get('q') ?? '', page: Number.isInteger(page) && page > 0 ? page : 1 };
}

export function CustomersPage() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const [search, setSearch] = useState(filters.q);
  // The id stays after closing so the panel keeps its content while it slides out.
  const [detail, setDetail] = useState<{ id: string; open: boolean } | null>(null);

  const customers = useQuery({
    queryKey: [...qk.admin.customers(filters.q), filters.page],
    queryFn: () => fetchAdminCustomers(filters),
    placeholderData: keepPreviousData,
  });

  function setFilter(patch: Partial<AdminCustomerFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const entries: [string, string][] = [];
    if (next.q) entries.push(['q', next.q]);
    if (next.page > 1) entries.push(['page', String(next.page)]);
    setParams(new URLSearchParams(entries));
  }

  const pageCount = Math.ceil((customers.data?.total ?? 0) / ADMIN_PAGE_SIZE);

  return (
    <>
      <title>{pageTitle('회원 관리')}</title>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-lg font-medium">
          회원
          {customers.data ? (
            <span className="ml-2 text-sm font-normal text-ink-muted tabular-nums">
              {customers.data.total}
            </span>
          ) : null}
        </h1>
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setFilter({ q: search.trim() });
          }}
          className="relative md:w-72"
        >
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="이메일, 이름, 전화번호"
            aria-label="회원 검색"
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
      </div>

      <DataTable<AdminCustomer>
        label="회원 목록"
        rows={customers.data?.items}
        rowKey={(row) => row.id}
        loading={customers.isPending}
        error={customers.isError}
        onRetry={() => void customers.refetch()}
        columns={[
          {
            key: 'name',
            header: '이름',
            className: 'min-w-28',
            cell: (row) => (
              <button
                type="button"
                onClick={() => setDetail({ id: row.id, open: true })}
                className="text-left hover:underline"
              >
                {row.name}
              </button>
            ),
          },
          { key: 'email', header: '이메일', className: 'min-w-48', cell: (row) => row.email },
          {
            key: 'phone',
            header: '전화',
            className: 'tabular-nums',
            cell: (row) => formatPhone(row.phone),
          },
          {
            key: 'joined',
            header: '가입일',
            className: 'tabular-nums text-ink-muted',
            cell: (row) => formatDate(row.createdAt),
          },
          {
            key: 'orders',
            header: '주문',
            className: 'text-right tabular-nums',
            cell: (row) =>
              row.orderCount > 0 ? (
                <Link
                  to={`/admin/orders?customer=${row.id}`}
                  className="underline underline-offset-4"
                >
                  {row.orderCount}
                </Link>
              ) : (
                <span className="text-ink-muted">0</span>
              ),
          },
          {
            key: 'marketing',
            header: '마케팅',
            cell: (row) =>
              row.marketingAgreedAt ? '동의' : <span className="text-ink-muted">미동의</span>,
          },
        ]}
      />
      <Pagination
        page={filters.page}
        pageCount={pageCount}
        onChange={(page) => setFilter({ page })}
        className="mt-6"
      />

      <Drawer
        open={detail?.open ?? false}
        onClose={() => setDetail((d) => (d ? { ...d, open: false } : d))}
        title="회원 정보"
      >
        {detail ? <CustomerDetail id={detail.id} /> : null}
      </Drawer>
    </>
  );
}

function CustomerDetail({ id }: { id: string }) {
  const customer = useQuery({
    queryKey: qk.admin.customer(id),
    queryFn: () => fetchAdminCustomer(id),
  });

  if (customer.isPending) {
    return (
      <div className="flex flex-col gap-3 px-4 py-6 lg:px-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (customer.isError) {
    return <ErrorState onRetry={() => void customer.refetch()} className="px-4 py-6 lg:px-6" />;
  }
  if (!customer.data) {
    return <p className="px-4 py-6 text-sm text-ink-muted lg:px-6">탈퇴한 회원입니다</p>;
  }

  const data = customer.data;
  const rows: [string, string][] = [
    ['이름', data.name],
    ['이메일', data.email],
    ['전화', formatPhone(data.phone)],
    ['가입일', formatDate(data.createdAt)],
    [
      '마케팅 수신',
      data.marketingAgreedAt ? `동의 ${formatDate(data.marketingAgreedAt)}` : '미동의',
    ],
  ];

  return (
    <div className="flex flex-col gap-8 px-4 py-6 lg:px-6">
      <dl className="grid grid-cols-[88px_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3">
        <h3 className="border-b border-ink pb-3 text-sm font-medium">최근 주문</h3>
        {data.orders.length === 0 ? (
          <p className="text-sm text-ink-muted">주문이 없습니다</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.orders.map((order) => (
              <li key={order.id}>
                <Link
                  to={`/admin/orders/${order.id}`}
                  className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-surface"
                >
                  <span className="flex flex-col">
                    <span className="tabular-nums">{order.order_no}</span>
                    <span className="text-2xs text-ink-muted tabular-nums">
                      {formatDateTime(order.created_at)} · {formatKRW(order.total)}
                    </span>
                  </span>
                  <StatusBadge status={order.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {data.orders.length >= CUSTOMER_RECENT_ORDERS ? (
          <Link
            to={`/admin/orders?customer=${data.id}`}
            className="self-start text-sm underline underline-offset-4 hover:text-ink-muted"
          >
            전체 주문
          </Link>
        ) : null}
      </section>
    </div>
  );
}
