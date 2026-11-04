import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import { NotFoundPage } from '@/app/NotFoundPage';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from '@/components/ui/toastStore';
import { pageTitle } from '@/config/site';
import { useSession } from '@/features/auth/session';
import { cancelMyOrder, useOrder, type OrderDetail } from '@/features/checkout/api';
import { BankTransferInfo } from '@/features/checkout/components/BankTransferInfo';
import { OrderStatusBadge } from '@/features/checkout/components/OrderStatusBadge';
import {
  OrderItems,
  OrderSummary,
  ShippingAddress,
} from '@/features/checkout/components/OrderSummary';
import { cancelRequestSchema, type CancelRequestValues } from '@/features/checkout/schemas';
import { formatDateTime } from '@/lib/format';
import { qk } from '@/lib/queryKeys';
import { rpcErrorMessage } from '@/lib/rpcErrors';
import { CARRIERS, ORDER_STATUS_LABEL } from '@/types/domain';

const sectionTitle = 'border-b border-ink pb-3 text-md font-medium';

type Pending = 'cancel' | 'request' | null;

export function OrderDetailPage() {
  const { orderId = '' } = useParams();
  const order = useOrder(orderId);
  const [dialog, setDialog] = useState<Pending>(null);

  if (order.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (order.isError) return <ErrorState onRetry={() => void order.refetch()} />;
  if (!order.data) return <NotFoundPage />;

  const data = order.data;
  const cancellable = data.status === 'pending_payment';
  const requestable =
    (data.status === 'paid' || data.status === 'preparing') && data.cancel_requested_at === null;
  const carrier = CARRIERS.find((c) => c.code === data.carrier);

  return (
    <section className="flex flex-col gap-10">
      <title>{pageTitle('주문 상세')}</title>
      <div className="flex flex-col gap-4">
        <Link
          to="/account/orders"
          className="-ml-1 inline-flex items-center gap-1 self-start text-sm text-ink-muted hover:text-ink"
        >
          <Icon icon={ChevronLeft} size={16} />
          주문내역
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-md font-medium tabular-nums">주문번호 {data.order_no}</h2>
          <OrderStatusBadge status={data.status} />
        </div>
        <p className="-mt-2 text-sm text-ink-muted tabular-nums">
          {formatDateTime(data.created_at)}
        </p>
      </div>

      {data.status === 'pending_payment' ? (
        <div className="flex flex-col gap-4">
          <h3 className={sectionTitle}>입금 안내</h3>
          <BankTransferInfo order={data} />
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <h3 className={sectionTitle}>진행 상황</h3>
        <Timeline order={data} />
        {data.cancel_requested_at && (data.status === 'paid' || data.status === 'preparing') ? (
          <p className="text-sm break-words text-ink-muted">취소 사유 {data.cancel_reason}</p>
        ) : null}
      </div>

      {data.tracking_no ? (
        <div className="flex flex-col gap-4">
          <h3 className={sectionTitle}>배송 조회</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-base">
            <span>{carrier?.name ?? data.carrier}</span>
            <span className="tabular-nums">{data.tracking_no}</span>
            {carrier ? (
              <a
                href={carrier.trackUrl(data.tracking_no)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline underline-offset-4 hover:text-ink-muted"
              >
                조회하기
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        <h3 className={sectionTitle}>주문 상품</h3>
        <OrderItems items={data.items} />
        <OrderSummary subtotal={data.subtotal} shippingFee={data.shipping_fee} />
      </div>

      <div className="flex flex-col gap-4">
        <h3 className={sectionTitle}>배송지</h3>
        <ShippingAddress order={data} />
      </div>

      {cancellable || requestable ? (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDialog(cancellable ? 'cancel' : 'request')}
          >
            {cancellable ? '주문 취소' : '취소 요청'}
          </Button>
        </div>
      ) : null}

      <CancelDialog order={data} mode={dialog} onClose={() => setDialog(null)} />
    </section>
  );
}

const EXPIRED_NOTE = '입금 기한 만료';

function eventLabel(event: OrderDetail['events'][number]): string {
  if (event.from_status === null) return '주문 접수';
  if (event.from_status === event.to_status) {
    return event.note === '취소 요청' ? '취소 요청' : '배송 정보 변경';
  }
  if (event.to_status === 'cancelled' && event.note === EXPIRED_NOTE)
    return '취소 · 입금 기한 만료';
  return ORDER_STATUS_LABEL[event.to_status];
}

/**
 * order_events, oldest first. Admin notes (refund details, internal memos) are not shown; only the
 * fixed system notes map to labels.
 */
function Timeline({ order }: { order: OrderDetail }) {
  return (
    <ol className="flex flex-col">
      {order.events.map((event, index) => {
        const last = index === order.events.length - 1;
        return (
          <li key={event.id} className="flex gap-4">
            <div className="flex w-2 flex-col items-center pt-1.5" aria-hidden="true">
              <span className={last ? 'size-2 bg-ink' : 'size-2 border border-ink-muted'} />
              {last ? null : <span className="w-px flex-1 bg-line" />}
            </div>
            <div className={last ? 'flex flex-col' : 'flex flex-col pb-5'}>
              <span className={last ? 'text-base font-medium' : 'text-base'}>
                {eventLabel(event)}
              </span>
              <span className="text-xs text-ink-muted tabular-nums">
                {formatDateTime(event.created_at)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function CancelDialog({
  order,
  mode,
  onClose,
}: {
  order: OrderDetail;
  mode: Pending;
  onClose: () => void;
}) {
  const id = useId();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CancelRequestValues>({
    resolver: zodResolver(cancelRequestSchema),
    defaultValues: { reason: '' },
  });

  const close = () => {
    reset();
    onClose();
  };

  const cancel = useMutation({
    mutationFn: (reason: string) => cancelMyOrder(order.id, reason),
    onSuccess: async () => {
      // Prefix keys: list pages, active-order count and this order; stock came back too.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.orders(user?.id) }),
        queryClient.invalidateQueries({ queryKey: qk.order(order.id) }),
        queryClient.invalidateQueries({ queryKey: qk.products() }),
      ]);
      toast(mode === 'cancel' ? '주문을 취소했습니다' : '취소를 요청했습니다');
      close();
    },
    onError: (error) => {
      toast(rpcErrorMessage(error), 'error');
      void queryClient.invalidateQueries({ queryKey: qk.order(order.id) });
    },
  });

  const formId = `${id}-form`;

  return (
    <Dialog
      open={mode !== null}
      onClose={close}
      title={mode === 'request' ? '취소 요청' : '주문 취소'}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={close}>
            닫기
          </Button>
          {mode === 'request' ? (
            <Button type="submit" form={formId} size="sm" loading={cancel.isPending}>
              요청하기
            </Button>
          ) : (
            <Button size="sm" loading={cancel.isPending} onClick={() => cancel.mutate('')}>
              주문 취소
            </Button>
          )}
        </>
      }
    >
      {mode === 'request' ? (
        <form
          id={formId}
          noValidate
          onSubmit={handleSubmit((values) => cancel.mutate(values.reason))}
        >
          <Field id={`${id}-reason`} label="사유" required error={errors.reason?.message}>
            <Textarea
              id={`${id}-reason`}
              rows={4}
              maxLength={200}
              invalid={Boolean(errors.reason)}
              {...register('reason')}
            />
          </Field>
        </form>
      ) : (
        <p>주문을 취소할까요?</p>
      )}
    </Dialog>
  );
}
