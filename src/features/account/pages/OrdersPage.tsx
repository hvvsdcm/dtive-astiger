import { Link, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { pageTitle } from '@/config/site';
import { StorageImage } from '@/features/catalog/components/StorageImage';
import { ORDERS_PAGE_SIZE, useMyOrders } from '@/features/checkout/api';
import { OrderStatusBadge } from '@/features/checkout/components/OrderStatusBadge';
import { formatDate, formatKRW } from '@/lib/format';

export function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const orders = useMyOrders(page - 1);
  const pageCount = orders.data ? Math.ceil(orders.data.total / ORDERS_PAGE_SIZE) : 0;

  return (
    <section className="flex flex-col gap-6">
      <title>{pageTitle('주문내역')}</title>
      <h2 className="text-md font-medium">주문내역</h2>

      {orders.isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : orders.isError ? (
        <ErrorState onRetry={() => void orders.refetch()} />
      ) : orders.data.items.length === 0 ? (
        <EmptyState title="주문 내역이 없습니다" action={{ label: '쇼핑 계속하기', to: '/shop' }} />
      ) : (
        <>
          <ul className="border-t border-line">
            {orders.data.items.map((order) => {
              const [first, ...rest] = order.items;
              return (
                <li key={order.id} className="border-b border-line">
                  <Link
                    to={`/account/orders/${order.id}`}
                    className="flex gap-4 py-5 transition-colors hover:bg-surface"
                  >
                    <StorageImage
                      path={first?.image_path ?? null}
                      alt=""
                      sizes="64px"
                      className="aspect-[3/4] w-16 shrink-0"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                      <p className="text-ink-muted tabular-nums">
                        {formatDate(order.created_at)} · {order.order_no}
                      </p>
                      <p className="truncate text-base">
                        {first?.product_name}
                        {rest.length > 0 ? ` 외 ${rest.length}건` : ''}
                      </p>
                      <p className="tabular-nums">{formatKRW(order.total)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <OrderStatusBadge status={order.status} />
                      {order.cancel_requested_at &&
                      (order.status === 'paid' || order.status === 'preparing') ? (
                        <span className="text-xs text-ink-muted">취소 요청</span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Pagination
            page={page}
            pageCount={pageCount}
            onChange={(next) => setSearchParams(next > 1 ? { page: String(next) } : {})}
          />
        </>
      )}
    </section>
  );
}
