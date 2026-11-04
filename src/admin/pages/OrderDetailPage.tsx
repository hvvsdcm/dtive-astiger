import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import { NotFoundPage } from '@/app/NotFoundPage';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from '@/components/ui/toastStore';
import { pageTitle } from '@/config/site';
import { OrderItems, OrderSummary } from '@/features/checkout/components/OrderSummary';
import { formatDateTime, formatKRW } from '@/lib/format';
import { qk } from '@/lib/queryKeys';
import { rpcErrorMessage } from '@/lib/rpcErrors';
import { CARRIERS, ORDER_TRANSITIONS, type OrderStatus } from '@/types/domain';
import {
  adminErrorMessage,
  fetchAdminOrder,
  saveAdminNote,
  setOrderTracking,
  updateOrderStatus,
  type AdminOrderDetail,
} from '../api';
import { OrderTimeline } from '../components/OrderTimeline';
import { StatusBadge } from '../components/StatusBadge';
import { trackingSchema, type TrackingFormInput, type TrackingValues } from '../schemas';

const sectionTitle = 'border-b border-ink pb-3 text-sm font-medium';

const formatPhone = (phone: string) => phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');

/** Transitions that ask for confirmation (and, for cancel/refund, a note). */
type ConfirmStatus = Extract<OrderStatus, 'paid' | 'cancelled' | 'refunded'>;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className={sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-[88px_1fr] gap-x-4 gap-y-2 text-sm">{children}</dl>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

/** Refetches everything an order change can touch: this order, lists, counts and stock. */
function useOrderInvalidation(orderId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.admin.order(orderId) }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'customer'] }),
      queryClient.invalidateQueries({ queryKey: qk.admin.stats }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
      queryClient.invalidateQueries({ queryKey: ['product'] }),
    ]);
}

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const order = useQuery({ queryKey: qk.admin.order(id), queryFn: () => fetchAdminOrder(id) });

  if (order.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (order.isError) return <ErrorState onRetry={() => void order.refetch()} />;
  if (!order.data) return <NotFoundPage />;
  return <OrderDetail order={order.data} />;
}

function OrderDetail({ order }: { order: AdminOrderDetail }) {
  const carrier = CARRIERS.find((c) => c.code === order.carrier);
  const openRequest =
    order.cancel_requested_at !== null && (order.status === 'paid' || order.status === 'preparing');

  return (
    <>
      <title>{pageTitle(`주문 ${order.order_no}`)}</title>
      <Link
        to="/admin/orders"
        className="mb-4 -ml-1 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <Icon icon={ChevronLeft} size={16} />
        주문 목록
      </Link>
      <div className="mb-8 flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-medium tabular-nums">{order.order_no}</h1>
          <StatusBadge status={order.status} />
          {openRequest ? <Badge tone="danger">취소 요청</Badge> : null}
        </div>
        <p className="text-sm text-ink-muted tabular-nums">{formatDateTime(order.created_at)}</p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
        <aside className="flex flex-col gap-10 lg:order-last">
          <Section title="처리">
            <OrderActions order={order} />
          </Section>

          <Section title="입금">
            <Rows>
              <Row label="입금자명">{order.depositor_name}</Row>
              <Row label="입금 금액">
                <span className="font-semibold tabular-nums">{formatKRW(order.total)}</span>
              </Row>
              <Row label="계좌">
                {order.bank_name} {order.bank_account} {order.bank_holder}
              </Row>
              <Row label="입금 기한">
                <span className="tabular-nums">{formatDateTime(order.payment_due_at)}</span>
              </Row>
              {order.paid_at ? (
                <Row label="입금 확인">
                  <span className="tabular-nums">{formatDateTime(order.paid_at)}</span>
                </Row>
              ) : null}
            </Rows>
          </Section>

          {order.tracking_no ? (
            <Section title="배송">
              <Rows>
                <Row label="택배사">{carrier?.name ?? order.carrier}</Row>
                <Row label="송장번호">
                  {carrier ? (
                    <a
                      href={carrier.trackUrl(order.tracking_no)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tabular-nums underline underline-offset-4 hover:text-ink-muted"
                    >
                      {order.tracking_no}
                    </a>
                  ) : (
                    order.tracking_no
                  )}
                </Row>
              </Rows>
            </Section>
          ) : null}

          <Section title="주문자">
            {order.customer ? (
              <div className="flex flex-col gap-3">
                <Rows>
                  <Row label="이름">{order.customer.name}</Row>
                  <Row label="이메일">{order.customer.email}</Row>
                  <Row label="연락처">
                    {order.customer.phone ? formatPhone(order.customer.phone) : '—'}
                  </Row>
                </Rows>
                <Link
                  to={`/admin/orders?customer=${order.customer.id}`}
                  className="self-start text-sm underline underline-offset-4 hover:text-ink-muted"
                >
                  이 회원의 주문
                </Link>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">탈퇴 회원</p>
            )}
          </Section>

          <Section title="관리자 메모 · 고객 비공개">
            <AdminNote order={order} />
          </Section>
        </aside>

        <div className="flex min-w-0 flex-col gap-10">
          {openRequest ? (
            <section className="flex flex-col gap-2 border border-danger p-4 text-sm">
              <h2 className="font-medium text-danger">취소 요청</h2>
              <p className="text-xs text-ink-muted tabular-nums">
                {formatDateTime(order.cancel_requested_at ?? '')}
              </p>
              <p className="break-words whitespace-pre-line">{order.cancel_reason}</p>
            </section>
          ) : null}

          <Section title="주문 상품">
            <OrderItems items={order.items} />
            <OrderSummary subtotal={order.subtotal} shippingFee={order.shipping_fee} />
          </Section>

          <Section title="배송지">
            <Rows>
              <Row label="수령인">{order.recipient}</Row>
              <Row label="연락처">{formatPhone(order.phone)}</Row>
              <Row label="주소">
                ({order.postal_code}) {order.address1} {order.address2}
              </Row>
              <Row label="배송 메모">{order.memo || '—'}</Row>
            </Rows>
          </Section>

          {order.status === 'cancelled' || order.status === 'refunded' ? (
            <Section title="취소">
              <Rows>
                <Row label="취소 일시">
                  <span className="tabular-nums">
                    {order.cancelled_at ? formatDateTime(order.cancelled_at) : '—'}
                  </span>
                </Row>
                <Row label="사유">
                  <span className="whitespace-pre-line">{order.cancel_reason ?? '—'}</span>
                </Row>
                {order.refunded_at ? (
                  <Row label="환불 완료">
                    <span className="tabular-nums">{formatDateTime(order.refunded_at)}</span>
                  </Row>
                ) : null}
              </Rows>
            </Section>
          ) : null}

          <Section title="진행 기록">
            <OrderTimeline order={order} />
          </Section>
        </div>
      </div>
    </>
  );
}

function OrderActions({ order }: { order: AdminOrderDetail }) {
  const invalidate = useOrderInvalidation(order.id);
  const [confirm, setConfirm] = useState<ConfirmStatus | null>(null);
  const [editTracking, setEditTracking] = useState(false);

  const next = ORDER_TRANSITIONS[order.status].filter(
    (status) => status !== 'refunded' || order.paid_at !== null,
  );

  const transition = useMutation({
    mutationFn: ({ status, note }: { status: OrderStatus; note: string }) =>
      updateOrderStatus(order.id, status, note),
    onSuccess: async () => {
      await invalidate();
      toast('상태를 변경했습니다');
      setConfirm(null);
    },
    onError: async (error) => {
      // INVALID_TRANSITION means someone (or the expiry job) changed it first: show the current state.
      toast(rpcErrorMessage(error), 'error');
      setConfirm(null);
      await invalidate();
    },
  });

  const canShip = next.includes('shipped');
  const showTracking = canShip || (order.status === 'shipped' && editTracking);

  if (next.length === 0 && order.status !== 'shipped') {
    return <p className="text-sm text-ink-muted">처리할 작업이 없습니다</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {next.includes('paid') ? (
          <Button size="sm" onClick={() => setConfirm('paid')}>
            입금 확인
          </Button>
        ) : null}
        {next.includes('preparing') ? (
          <Button
            size="sm"
            loading={transition.isPending && transition.variables?.status === 'preparing'}
            onClick={() => transition.mutate({ status: 'preparing', note: '' })}
          >
            상품 준비중
          </Button>
        ) : null}
        {next.includes('delivered') ? (
          <Button
            size="sm"
            loading={transition.isPending && transition.variables?.status === 'delivered'}
            onClick={() => transition.mutate({ status: 'delivered', note: '' })}
          >
            배송 완료
          </Button>
        ) : null}
        {order.status === 'shipped' && !editTracking ? (
          <Button size="sm" variant="secondary" onClick={() => setEditTracking(true)}>
            송장 수정
          </Button>
        ) : null}
        {next.includes('refunded') ? (
          <Button size="sm" onClick={() => setConfirm('refunded')}>
            환불 완료
          </Button>
        ) : null}
        {next.includes('cancelled') ? (
          <Button size="sm" variant="danger" onClick={() => setConfirm('cancelled')}>
            주문 취소
          </Button>
        ) : null}
      </div>

      {showTracking ? (
        <TrackingForm
          order={order}
          onDone={async () => {
            setEditTracking(false);
            await invalidate();
          }}
          onCancel={order.status === 'shipped' ? () => setEditTracking(false) : undefined}
        />
      ) : null}

      <ConfirmDialog
        order={order}
        status={confirm}
        pending={transition.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={(note) => {
          if (confirm) transition.mutate({ status: confirm, note });
        }}
      />
    </div>
  );
}

const CONFIRM_TEXT: Record<ConfirmStatus, { title: string; action: string; body: string }> = {
  paid: { title: '입금 확인', action: '입금 확인', body: '입금을 확인했나요?' },
  cancelled: {
    title: '주문 취소',
    action: '주문 취소',
    body: '주문을 취소하고 재고를 되돌립니다.',
  },
  refunded: { title: '환불 완료', action: '환불 완료', body: '환불 이체를 마쳤나요?' },
};

function ConfirmDialog({
  order,
  status,
  pending,
  onClose,
  onConfirm,
}: {
  order: AdminOrderDetail;
  status: ConfirmStatus | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const id = useId();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  // Cancelling a paid order means a refund is owed: the note (refund account, amount) is required.
  const noteRequired = status === 'cancelled' && order.status !== 'pending_payment';
  const withNote = status === 'cancelled' || status === 'refunded';

  function close() {
    setNote('');
    setError('');
    onClose();
  }

  function submit() {
    const trimmed = note.trim();
    if (noteRequired && !trimmed) {
      setError('환불 계좌와 금액을 입력하세요');
      return;
    }
    onConfirm(trimmed);
    setNote('');
    setError('');
  }

  const text = status ? CONFIRM_TEXT[status] : null;

  return (
    <Dialog
      open={status !== null}
      onClose={close}
      title={text?.title ?? ''}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={close}>
            닫기
          </Button>
          <Button
            size="sm"
            variant={status === 'cancelled' ? 'danger' : 'primary'}
            loading={pending}
            onClick={submit}
          >
            {text?.action}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p>
          {text?.body}
          <span className="mt-1 block text-sm text-ink-muted tabular-nums">
            {order.order_no} · {order.depositor_name} · {formatKRW(order.total)}
          </span>
        </p>
        {withNote ? (
          <Field
            id={`${id}-note`}
            label={noteRequired ? '환불 계좌 · 금액 (고객 비공개)' : '메모 (고객 비공개)'}
            required={noteRequired}
            error={error || undefined}
          >
            <Textarea
              id={`${id}-note`}
              rows={3}
              maxLength={500}
              value={note}
              invalid={Boolean(error)}
              onChange={(event) => {
                setNote(event.target.value);
                if (error) setError('');
              }}
            />
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
}

function TrackingForm({
  order,
  onDone,
  onCancel,
}: {
  order: AdminOrderDetail;
  onDone: () => Promise<void>;
  onCancel?: () => void;
}) {
  const id = useId();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TrackingFormInput, unknown, TrackingValues>({
    resolver: zodResolver(trackingSchema),
    defaultValues: { carrier: order.carrier ?? '', trackingNo: order.tracking_no ?? '' },
  });

  const save = useMutation({
    mutationFn: (values: TrackingValues) =>
      setOrderTracking(order.id, values.carrier, values.trackingNo),
    onSuccess: async () => {
      toast(order.status === 'shipped' ? '송장을 수정했습니다' : '배송중으로 변경했습니다');
      await onDone();
    },
    onError: async (error) => {
      toast(rpcErrorMessage(error), 'error');
      await onDone();
    },
  });

  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit((values) => save.mutate(values))(event)}
      className="flex flex-col gap-3"
    >
      <Field id={`${id}-carrier`} label="택배사" required error={errors.carrier?.message}>
        <Select id={`${id}-carrier`} invalid={Boolean(errors.carrier)} {...register('carrier')}>
          <option value="">선택</option>
          {CARRIERS.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field id={`${id}-no`} label="송장번호" required error={errors.trackingNo?.message}>
        <Input
          id={`${id}-no`}
          inputMode="numeric"
          autoComplete="off"
          invalid={Boolean(errors.trackingNo)}
          {...register('trackingNo')}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={save.isPending}>
          {order.status === 'shipped' ? '송장 저장' : '송장 입력 · 배송중'}
        </Button>
        {onCancel ? (
          <Button size="sm" variant="secondary" onClick={onCancel}>
            취소
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function AdminNote({ order }: { order: AdminOrderDetail }) {
  const id = useId();
  const queryClient = useQueryClient();
  const [note, setNote] = useState(order.admin_note);
  const save = useMutation({
    mutationFn: () => saveAdminNote(order.id, note.trim()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.admin.order(order.id) });
      toast('저장했습니다');
    },
    onError: (error) => toast(adminErrorMessage(error), 'error'),
  });

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={`${id}-note`} className="sr-only">
        관리자 메모
      </label>
      <Textarea
        id={`${id}-note`}
        rows={3}
        maxLength={1000}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button
        size="sm"
        variant="secondary"
        className="self-start"
        disabled={note.trim() === order.admin_note}
        loading={save.isPending}
        onClick={() => save.mutate()}
      >
        메모 저장
      </Button>
    </div>
  );
}
