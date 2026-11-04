import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ButtonLink } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSiteSettings } from '@/features/checkout/api';
import { freeShippingRemaining, shippingFeeFor } from '@/features/checkout/pricing';
import { formatKRW } from '@/lib/format';
import { selectCount, selectSubtotal, useCart } from '../store';
import { CartLine } from './CartLine';

/** Right-hand cart panel, opened from the header bag icon. Mounted once in StoreLayout. */
export function CartDrawer() {
  const isOpen = useCart((state) => state.isOpen);
  const close = useCart((state) => state.close);
  const lines = useCart((state) => state.lines);
  const count = useCart(selectCount);
  const subtotal = useCart(selectSubtotal);
  const settings = useSiteSettings();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Navigation by other means (browser back, header links) closes the panel too.
  useEffect(() => {
    close();
  }, [pathname, close]);

  const fee = settings.data ? shippingFeeFor(subtotal, settings.data) : null;
  const remaining = settings.data ? freeShippingRemaining(subtotal, settings.data) : null;

  return (
    <Drawer
      open={isOpen}
      onClose={close}
      title={`장바구니 (${count})`}
      footer={
        lines.length > 0 ? (
          <div className="flex flex-col gap-4">
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt>상품 합계</dt>
                <dd className="tabular-nums">{formatKRW(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>배송비</dt>
                <dd className="tabular-nums">
                  {fee === null ? '—' : fee === 0 ? '무료' : formatKRW(fee)}
                </dd>
              </div>
            </dl>
            {remaining !== null ? (
              <p className="text-xs text-ink-muted">{formatKRW(remaining)} 더 담으면 무료배송</p>
            ) : null}
            <ButtonLink to="/checkout" fullWidth onClick={close}>
              주문하기
            </ButtonLink>
          </div>
        ) : undefined
      }
    >
      {lines.length === 0 ? (
        <EmptyState
          title="장바구니가 비어 있습니다"
          action={{
            label: '쇼핑 계속하기',
            onClick: () => {
              close();
              void navigate('/shop');
            },
          }}
        />
      ) : (
        <ul className="divide-y divide-line px-4 lg:px-6">
          {lines.map((line) => (
            <CartLine key={line.variantId} line={line} mode="drawer" />
          ))}
        </ul>
      )}
    </Drawer>
  );
}
