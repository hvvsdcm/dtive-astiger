import { StorageImage } from '@/features/catalog/components/StorageImage';
import { formatKRW } from '@/lib/format';
import type { Order, OrderItem } from '../api';

/** Subtotal / shipping / total rows. `shippingFee` null while the rule is loading. */
export function OrderSummary({
  subtotal,
  shippingFee,
}: {
  subtotal: number;
  shippingFee: number | null;
}) {
  return (
    <dl className="flex flex-col gap-2 text-base">
      <div className="flex justify-between gap-4">
        <dt>상품 합계</dt>
        <dd className="tabular-nums">{formatKRW(subtotal)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>배송비</dt>
        <dd className="tabular-nums">
          {shippingFee === null ? '—' : shippingFee === 0 ? '무료' : formatKRW(shippingFee)}
        </dd>
      </div>
      <div className="mt-2 flex justify-between gap-4 border-t border-line pt-4 text-md">
        <dt className="font-medium">합계</dt>
        <dd className="font-semibold tabular-nums">
          {shippingFee === null ? '—' : formatKRW(subtotal + shippingFee)}
        </dd>
      </div>
    </dl>
  );
}

/** Ordered line items (snapshots from order_items). */
export function OrderItems({ items }: { items: OrderItem[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {items.map((item) => (
        <li key={item.id} className="flex gap-4 py-4 text-sm">
          <StorageImage
            path={item.image_path}
            alt=""
            sizes="64px"
            className="aspect-[3/4] w-16 shrink-0"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="line-clamp-2">{item.product_name}</p>
            {item.variant_label ? <p className="text-ink-muted">{item.variant_label}</p> : null}
            <p className="text-ink-muted">수량 {item.quantity}</p>
          </div>
          <p className="shrink-0 tabular-nums">{formatKRW(item.unit_price * item.quantity)}</p>
        </li>
      ))}
    </ul>
  );
}

/** Recipient block from the order snapshot. */
export function ShippingAddress({
  order,
}: {
  order: Pick<Order, 'recipient' | 'phone' | 'postal_code' | 'address1' | 'address2' | 'memo'>;
}) {
  return (
    <div className="flex flex-col gap-1 text-base">
      <p>{order.recipient}</p>
      <p className="text-ink-muted">
        {order.phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3')}
      </p>
      <p className="break-words text-ink-muted">
        ({order.postal_code}) {order.address1} {order.address2}
      </p>
      {order.memo ? <p className="break-words text-ink-muted">{order.memo}</p> : null}
    </div>
  );
}
