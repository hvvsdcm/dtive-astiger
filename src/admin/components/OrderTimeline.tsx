import { formatDateTime } from '@/lib/format';
import { ORDER_STATUS_LABEL } from '@/types/domain';
import type { AdminOrderDetail } from '../api';

type Event = AdminOrderDetail['events'][number];

function eventLabel(event: Event): string {
  if (event.from_status === null) return '주문 접수';
  if (event.from_status === event.to_status) {
    return event.note === '취소 요청' ? '취소 요청' : '송장 수정';
  }
  return ORDER_STATUS_LABEL[event.to_status];
}

/** Who acted: no actor is the expiry job, the orderer is the customer, anyone else an admin. */
function actorLabel(event: Event, order: AdminOrderDetail): string {
  if (event.actor_id === null) return '시스템';
  if (event.actor_id === order.user_id) return '고객';
  return '관리자';
}

/** Every order_events row, oldest first, with actor and the full note (admin view). */
export function OrderTimeline({ order }: { order: AdminOrderDetail }) {
  if (order.events.length === 0) return <p className="text-sm text-ink-muted">기록이 없습니다</p>;
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
            <div className={last ? 'flex min-w-0 flex-col' : 'flex min-w-0 flex-col pb-5'}>
              <span className={last ? 'text-sm font-medium' : 'text-sm'}>{eventLabel(event)}</span>
              <span className="text-xs text-ink-muted tabular-nums">
                {formatDateTime(event.created_at)} · {actorLabel(event, order)}
              </span>
              {event.note && event.note !== '취소 요청' ? (
                <span className="mt-1 text-sm break-words whitespace-pre-line">{event.note}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
