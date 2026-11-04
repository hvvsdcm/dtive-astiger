import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Tabs } from '@/components/ui/Tabs';
import { pageTitle } from '@/config/site';
import { formatDateTime, formatKRW } from '@/lib/format';
import { qk } from '@/lib/queryKeys';
import { ORDER_STATUSES, ORDER_STATUS_LABEL } from '@/types/domain';
import {
  ADMIN_PAGE_SIZE,
  fetchAdminCustomer,
  fetchAdminOrders,
  isUuid,
  type AdminOrderFilters,
  type AdminOrderListItem,
  type AdminOrderTab,
} from '../api';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';

const TABS: { value: AdminOrderTab; label: string }[] = [
  { value: 'all', label: '전체' },
  ...ORDER_STATUSES.map((status) => ({ value: status, label: ORDER_STATUS_LABEL[status] })),
  { value: 'cancel_requested', label: '취소 요청' },
];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function readFilters(params: URLSearchParams): AdminOrderFilters {
  const status = params.get('status');
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const customer = params.get('customer') ?? '';
  const page = Number(params.get('page'));
  return {
    status: TABS.some((tab) => tab.value === status) ? (status as AdminOrderTab) : 'all',
    q: params.get('q') ?? '',
    from: DAY.test(from) ? from : '',
    to: DAY.test(to) ? to : '',
    customer: isUuid(customer) ? customer : '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function DueCell({ row }: { row: AdminOrderListItem }) {
  if (row.status !== 'pending_payment') return null;
  return (
    <span className={row.paymentOverdue ? 'text-danger' : 'text-ink-muted'}>
      {row.paymentOverdue ? '기한 지남' : `${formatDateTime(row.payment_due_at)}까지`}
    </span>
  );
}

const columns: Column<AdminOrderListItem>[] = [
  {
    key: 'order',
    header: '주문번호',
    className: 'min-w-44',
    cell: (row) => (
      <Link to={`/admin/orders/${row.id}`} className="flex flex-col hover:underline">
        <span className="tabular-nums">{row.order_no}</span>
        <span className="text-2xs text-ink-muted tabular-nums">
          {formatDateTime(row.created_at)}
        </span>
      </Link>
    ),
  },
  {
    key: 'items',
    header: '상품',
    className: 'min-w-48',
    cell: (row) => (
      <span className="line-clamp-1">
        {row.firstItem}
        {row.otherItems > 0 ? <span className="text-ink-muted"> 외 {row.otherItems}건</span> : null}
      </span>
    ),
  },
  {
    key: 'customer',
    header: '주문자',
    cell: (row) => row.customerName ?? <span className="text-ink-muted">탈퇴 회원</span>,
  },
  { key: 'depositor', header: '입금자명', cell: (row) => row.depositor_name },
  {
    key: 'total',
    header: '금액',
    className: 'text-right tabular-nums',
    cell: (row) => formatKRW(row.total),
  },
  {
    key: 'status',
    header: '상태',
    className: 'min-w-36',
    cell: (row) => (
      <span className="flex flex-col items-start gap-1">
        <span className="flex flex-wrap gap-1">
          <StatusBadge status={row.status} />
          {row.cancel_requested_at && (row.status === 'paid' || row.status === 'preparing') ? (
            <Badge tone="danger">취소 요청</Badge>
          ) : null}
        </span>
        <span className="text-2xs tabular-nums">
          <DueCell row={row} />
        </span>
      </span>
    ),
  },
];

export function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const [search, setSearch] = useState(filters.q);

  const orders = useQuery({
    queryKey: qk.admin.orders(filters),
    queryFn: () => fetchAdminOrders(filters),
    placeholderData: keepPreviousData,
  });
  const customer = useQuery({
    queryKey: qk.admin.customer(filters.customer),
    queryFn: () => fetchAdminCustomer(filters.customer),
    enabled: filters.customer !== '',
  });

  function setFilter(patch: Partial<AdminOrderFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const entries: [string, string][] = [];
    if (next.status !== 'all') entries.push(['status', next.status]);
    if (next.q) entries.push(['q', next.q]);
    if (next.from) entries.push(['from', next.from]);
    if (next.to) entries.push(['to', next.to]);
    if (next.customer) entries.push(['customer', next.customer]);
    if (next.page > 1) entries.push(['page', String(next.page)]);
    setParams(new URLSearchParams(entries));
  }

  const pageCount = Math.ceil((orders.data?.total ?? 0) / ADMIN_PAGE_SIZE);

  return (
    <>
      <title>{pageTitle('주문 관리')}</title>
      <h1 className="mb-6 text-lg font-medium">
        주문
        {orders.data ? (
          <span className="ml-2 text-sm font-normal text-ink-muted tabular-nums">
            {orders.data.total}
          </span>
        ) : null}
      </h1>

      <div className="mb-4 overflow-x-auto">
        <Tabs
          label="주문 상태"
          items={TABS}
          value={filters.status}
          onChange={(status) => setFilter({ status })}
          className="min-w-max"
        />
      </div>

      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="시작일"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => setFilter({ from: event.target.value })}
            className="w-40"
          />
          <span aria-hidden="true" className="text-ink-muted">
            –
          </span>
          <Input
            type="date"
            aria-label="종료일"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => setFilter({ to: event.target.value })}
            className="w-40"
          />
        </div>
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
            placeholder="주문번호, 주문자, 입금자명"
            aria-label="주문 검색"
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

      {filters.customer ? (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span>회원 {customer.data === null ? '탈퇴 회원' : (customer.data?.name ?? '')}</span>
          <button
            type="button"
            onClick={() => setFilter({ customer: '' })}
            aria-label="회원 필터 해제"
            className="inline-flex size-8 items-center justify-center text-ink-muted hover:text-ink"
          >
            <Icon icon={X} size={16} />
          </button>
        </div>
      ) : null}

      <DataTable
        label="주문 목록"
        columns={columns}
        rows={orders.data?.items}
        rowKey={(row) => row.id}
        loading={orders.isPending}
        error={orders.isError}
        onRetry={() => void orders.refetch()}
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
