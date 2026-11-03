import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_LINE_QTY, selectCount, selectSubtotal, useCart, type CartLine } from './store';

const line = (overrides: Partial<CartLine> = {}): Omit<CartLine, 'quantity'> => ({
  variantId: 'v1',
  productId: 'p1',
  slug: 'wool-coat',
  name: '울 코트',
  color: 'Black',
  size: 'M',
  unitPrice: 289000,
  imagePath: null,
  stock: 5,
  ...overrides,
});

describe('cart store', () => {
  beforeEach(() => {
    useCart.setState({ lines: [], isOpen: false });
  });

  it('adds a line and merges the same variant', () => {
    useCart.getState().add(line());
    useCart.getState().add(line(), 2);
    const { lines } = useCart.getState();
    expect(lines).toHaveLength(1);
    expect(lines[0]?.quantity).toBe(3);
  });

  it('caps quantity at stock and at 10', () => {
    useCart.getState().add(line({ stock: 3 }), 5);
    expect(useCart.getState().lines[0]?.quantity).toBe(3);
    useCart.getState().add(line({ variantId: 'v2', stock: 99 }), 25);
    expect(useCart.getState().lines[1]?.quantity).toBe(MAX_LINE_QTY);
  });

  it('ignores sold-out variants', () => {
    useCart.getState().add(line({ stock: 0 }));
    expect(useCart.getState().lines).toHaveLength(0);
  });

  it('clamps setQty to 1..min(10, stock)', () => {
    useCart.getState().add(line({ stock: 4 }));
    useCart.getState().setQty('v1', 9);
    expect(useCart.getState().lines[0]?.quantity).toBe(4);
    useCart.getState().setQty('v1', 0);
    expect(useCart.getState().lines[0]?.quantity).toBe(1);
  });

  it('removes, clears and toggles the drawer', () => {
    useCart.getState().add(line());
    useCart.getState().add(line({ variantId: 'v2' }));
    useCart.getState().remove('v1');
    expect(useCart.getState().lines.map((l) => l.variantId)).toEqual(['v2']);
    useCart.getState().open();
    expect(useCart.getState().isOpen).toBe(true);
    useCart.getState().close();
    useCart.getState().clear();
    expect(useCart.getState()).toMatchObject({ lines: [], isOpen: false });
  });

  it('computes subtotal and count', () => {
    useCart.getState().add(line({ unitPrice: 10000 }), 2);
    useCart.getState().add(line({ variantId: 'v2', unitPrice: 5000 }), 3);
    expect(selectSubtotal(useCart.getState())).toBe(35000);
    expect(selectCount(useCart.getState())).toBe(5);
  });

  it('persists lines (not drawer state) under da.cart.v1', () => {
    useCart.getState().add(line());
    useCart.getState().open();
    const stored = JSON.parse(localStorage.getItem('da.cart.v1') ?? '{}');
    expect(stored.state.lines).toHaveLength(1);
    expect(stored.state.isOpen).toBeUndefined();
  });
});
