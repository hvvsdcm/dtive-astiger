import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/toastStore';
import { pageTitle } from '@/config/site';
import { formatDateTime, formatKRW } from '@/lib/format';
import { qk } from '@/lib/queryKeys';
import { rpcErrorMessage } from '@/lib/rpcErrors';
import { ORDER_STATUS_LABEL } from '@/types/domain';
import {
  expireUnpaidOrders,
  fetchCancelRequestCount,
  fetchDashboardStats,
  fetchRecentOrders,
  type AdminOrderListItem,
  type DashboardStats,
} from '../api';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';

const COUNT_KEYS = ['pending_payment', 'paid', 'preparing', 'shipped'] as const;

type LowStock = DashboardStats['low_stock'][number];

function StatCard({ label, value, to }: { label: string; value: string; to?: string }) {
  const body = (
    <>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-2 text-lg font-medium tabular-nums">{value}</dd>
    </>
  );
  return to ? (
    <Link to={to} className="block border border-line p-4 transition-colors hover:border-ink">
      {body}
    </Link>
  ) : (
    <div className="border border-line p-4">{body}</div>
  );
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const stats = useQuery({ queryKey: qk.admin.stats, queryFn: fetchDashboardStats });
  const cancelRequests = useQuery({
    queryKey: qk.admin.orders({ cancelRequests: 'count' }),
    queryFn: fetchCancelRequestCount,
  });
  const recent = useQuery({
    queryKey: qk.admin.orders({ recent: 8 }),
    queryFn: () => fetchRecentOrders(8),
  });

  const expire = useMutation({
    mutationFn: expireUnpaidOrders,
    onSuccess: async (count) => {
      toast(count > 0 ? `${count}건을 취소했습니다` : '정리할 주문이 없습니다');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.admin.stats }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'order'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
      ]);
    },
    onError: (error) => toast(rpcErrorMessage(error), 'error'),
  });

  return (
    <>
      <title>{pageTitle('관리자')}</title>
      <h1 className="mb-6 text-lg font-medium">대시보드</h1>

      {stats.isError ? <ErrorState onRetry={() => void stats.refetch()} /> : null}

      {stats.isPending ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : null}

      {stats.data ? (
        <div className="flex flex-col gap-10">
          <dl className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {COUNT_KEYS.map((key) => (
              <StatCard
                key={key}
                label={ORDER_STATUS_LABEL[key]}
                value={`${stats.data.counts[key]}건`}
                to={`/admin/orders?status=${key}`}
              />
            ))}
            <StatCard label="오늘 주문" value={`${stats.data.today_orders}건`} />
            <StatCard label="30일 매출" value={formatKRW(stats.data.revenue_30d)} />
          </dl>

          <section aria-labelledby="pending-title">
            <h2 id="pending-title" className="mb-3 text-sm font-medium">
              처리 대기
            </h2>
            <div className="flex flex-col divide-y divide-line border-y border-line text-sm">
              <Link
                to="/admin/orders?status=pending_payment"
                className="flex h-12 items-center justify-between gap-4 hover:bg-surface"
              >
                <span>입금 확인 대기</span>
                <span className="tabular-nums">{stats.data.counts.pending_payment}건</span>
              </Link>
              <Link
                to="/admin/orders?status=cancel_requested"
                className="flex h-12 items-center justify-between gap-4 hover:bg-surface"
              >
                <span>취소 요청</span>
                <span className={cancelRequests.data ? 'text-danger tabular-nums' : 'tabular-nums'}>
                  {cancelRequests.data ?? '—'}건
                </span>
              </Link>
              <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
                <span>
                  입금 기한 지남{' '}
                  <span className="tabular-nums">{stats.data.expired_pending}건</span>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={expire.isPending}
                  onClick={() => expire.mutate()}
                >
                  만료 주문 정리
                </Button>
              </div>
            </div>
          </section>

          <section aria-labelledby="recent-title">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 id="recent-title" className="text-sm font-medium">
                최근 주문
              </h2>
              <Link to="/admin/orders" className="text-xs underline underline-offset-4">
                전체 보기
              </Link>
            </div>
            <DataTable<AdminOrderListItem>
              label="최근 주문"
              rows={recent.data}
              rowKey={(row) => row.id}
              loading={recent.isPending}
              error={recent.isError}
              onRetry={() => void recent.refetch()}
              emptyText="주문이 없습니다"
              columns={[
                {
                  key: 'order',
                  header: '주문번호',
                  className: 'min-w-40',
                  cell: (row) => (
                    <Link to={`/admin/orders/${row.id}`} className="tabular-nums hover:underline">
                      {row.order_no}
                    </Link>
                  ),
                },
                {
                  key: 'time',
                  header: '주문일시',
                  className: 'tabular-nums text-ink-muted',
                  cell: (row) => formatDateTime(row.created_at),
                },
                {
                  key: 'customer',
                  header: '주문자',
                  cell: (row) =>
                    row.customerName ?? <span className="text-ink-muted">탈퇴 회원</span>,
                },
                {
                  key: 'total',
                  header: '금액',
                  className: 'text-right tabular-nums',
                  cell: (row) => formatKRW(row.total),
                },
                {
                  key: 'status',
                  header: '상태',
                  cell: (row) => <StatusBadge status={row.status} />,
                },
              ]}
            />
          </section>

          <section aria-labelledby="low-stock-title">
            <h2 id="low-stock-title" className="mb-3 text-sm font-medium">
              재고 3개 이하
            </h2>
            <DataTable<LowStock>
              label="재고 3개 이하"
              rows={stats.data.low_stock}
              rowKey={(row) => row.variant_id}
              emptyText="없습니다"
              columns={[
                { key: 'product', header: '상품', cell: (row) => row.product_name },
                { key: 'sku', header: 'SKU', cell: (row) => row.sku },
                {
                  key: 'stock',
                  header: '재고',
                  className: 'w-20 text-right tabular-nums',
                  cell: (row) => (
                    <span className={row.stock === 0 ? 'text-danger' : undefined}>
                      {row.stock === 0 ? '품절' : row.stock}
                    </span>
                  ),
                },
              ]}
            />
          </section>
        </div>
      ) : null}
    </>
  );
}
