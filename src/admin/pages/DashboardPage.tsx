import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { pageTitle } from '@/config/site';
import { formatKRW } from '@/lib/format';
import { qk } from '@/lib/queryKeys';
import { ORDER_STATUS_LABEL } from '@/types/domain';
import { fetchDashboardStats, type DashboardStats } from '../api';
import { DataTable } from '../components/DataTable';

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
  const stats = useQuery({ queryKey: qk.admin.stats, queryFn: fetchDashboardStats });

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
