import { Link } from 'react-router';
import { cn } from '@/components/ui/cn';
import { StorageImage } from '@/features/catalog/components/StorageImage';
import { BLOCKING_NOTICES, LINE_NOTICE_TEXT, type LineNotice } from '@/features/checkout/reconcile';
import { formatKRW } from '@/lib/format';
import { MAX_LINE_QTY, useCart, type CartLine as CartLineData } from '../store';
import { QtyStepper } from './QtyStepper';

export type CartLineProps = {
  line: CartLineData;
  /**
   * drawer: quantity stepper and remove. checkout: fixed quantity and the reconcile notices; a
   * line that blocks the order can still be removed.
   */
  mode: 'drawer' | 'checkout';
  notices?: LineNotice[];
};

export function CartLine({ line, mode, notices = [] }: CartLineProps) {
  const setQty = useCart((state) => state.setQty);
  const remove = useCart((state) => state.remove);
  const close = useCart((state) => state.close);
  const blocked = notices.some((notice) => BLOCKING_NOTICES.includes(notice));
  const option = [line.color, line.size].filter(Boolean).join(' / ');
  const href = `/products/${line.slug}`;

  return (
    <li className="flex gap-4 py-4">
      <Link to={href} onClick={close} className="w-20 shrink-0" tabIndex={-1} aria-hidden="true">
        <StorageImage path={line.imagePath} alt="" sizes="80px" className="aspect-[3/4] w-20" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        <div className="flex items-start justify-between gap-4">
          <Link
            to={href}
            onClick={close}
            className={cn('line-clamp-2 hover:underline', blocked && 'text-danger')}
          >
            {line.name}
          </Link>
          <span className="shrink-0 tabular-nums">{formatKRW(line.unitPrice * line.quantity)}</span>
        </div>
        {option ? <p className="text-ink-muted">{option}</p> : null}
        {notices.map((notice) => (
          <p
            key={notice}
            className={cn(
              'text-xs',
              BLOCKING_NOTICES.includes(notice) ? 'text-danger' : 'text-ink-muted',
            )}
          >
            {LINE_NOTICE_TEXT[notice]}
          </p>
        ))}
        <div className="mt-auto flex items-center justify-between gap-4 pt-2">
          {mode === 'drawer' ? (
            <QtyStepper
              value={line.quantity}
              max={Math.max(1, Math.min(MAX_LINE_QTY, line.stock))}
              label={line.name}
              onChange={(qty) => setQty(line.variantId, qty)}
            />
          ) : (
            <span className="text-ink-muted">수량 {line.quantity}</span>
          )}
          {mode === 'drawer' || blocked ? (
            <button
              type="button"
              onClick={() => remove(line.variantId)}
              className="text-xs text-ink-muted underline underline-offset-4 hover:text-ink"
              aria-label={`${line.name} 삭제`}
            >
              삭제
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
