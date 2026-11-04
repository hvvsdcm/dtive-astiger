import { Badge, type BadgeTone } from '@/components/ui/Badge';
import {
  ORDER_STATUS_LABEL,
  PRODUCT_STATUS_LABEL,
  type OrderStatus,
  type ProductStatus,
} from '@/types/domain';

type Status = OrderStatus | ProductStatus;

const TONE: Record<Status, BadgeTone> = {
  pending_payment: 'neutral',
  paid: 'ink',
  preparing: 'ink',
  shipped: 'ink',
  delivered: 'success',
  cancelled: 'muted',
  refunded: 'muted',
  draft: 'muted',
  active: 'success',
  archived: 'muted',
};

const LABEL: Record<Status, string> = { ...ORDER_STATUS_LABEL, ...PRODUCT_STATUS_LABEL };

/** Order or product status as a text badge; the tone only reinforces the label. */
export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Badge tone={TONE[status]} className={className}>
      {LABEL[status]}
    </Badge>
  );
}
