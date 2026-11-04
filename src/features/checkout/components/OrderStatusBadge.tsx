import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { ORDER_STATUS_LABEL, type OrderStatus } from '@/types/domain';

const TONE: Record<OrderStatus, BadgeTone> = {
  pending_payment: 'neutral',
  paid: 'ink',
  preparing: 'ink',
  shipped: 'ink',
  delivered: 'success',
  cancelled: 'muted',
  refunded: 'muted',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={TONE[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;
}
