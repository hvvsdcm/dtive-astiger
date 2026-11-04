import { useParams } from 'react-router';
import { NotFoundPage } from '@/app/NotFoundPage';
import { ButtonLink } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { pageTitle } from '@/config/site';
import { useOrder } from '../api';
import { BankTransferInfo } from '../components/BankTransferInfo';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import { OrderItems, OrderSummary, ShippingAddress } from '../components/OrderSummary';

const sectionTitle = 'border-b border-ink pb-3 text-md font-medium';

/** /orders/:orderId/complete — read from the database (RLS: own orders only, others 404). */
export function OrderCompletePage() {
  const { orderId = '' } = useParams();
  const order = useOrder(orderId);

  if (order.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-gutter py-12 lg:py-16">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (order.isError) return <ErrorState onRetry={() => void order.refetch()} />;
  if (!order.data) return <NotFoundPage />;

  const data = order.data;
  const pending = data.status === 'pending_payment';

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-12 px-gutter py-12 lg:py-16">
      <title>{pageTitle('주문 완료')}</title>
      <header className="flex flex-col gap-2">
        <h1 className="text-lg font-medium">주문 완료</h1>
        <div className="flex items-center gap-3 text-base">
          <span className="tabular-nums">주문번호 {data.order_no}</span>
          {pending ? null : <OrderStatusBadge status={data.status} />}
        </div>
      </header>

      {pending ? (
        <section className="flex flex-col gap-4">
          <h2 className={sectionTitle}>입금 안내</h2>
          <BankTransferInfo order={data} />
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className={sectionTitle}>배송지</h2>
        <ShippingAddress order={data} />
      </section>

      <section className="flex flex-col gap-6">
        <h2 className={sectionTitle}>주문 상품</h2>
        <OrderItems items={data.items} />
        <OrderSummary subtotal={data.subtotal} shippingFee={data.shipping_fee} />
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <ButtonLink to={`/account/orders/${data.id}`} variant="secondary" className="sm:flex-1">
          주문 상세
        </ButtonLink>
        <ButtonLink to="/shop" className="sm:flex-1">
          쇼핑 계속하기
        </ButtonLink>
      </div>
    </div>
  );
}
