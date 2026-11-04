import { describe, expect, it } from 'vitest';
import type { CartLine } from '@/features/cart/store';
import { freeShippingRemaining, shippingFeeFor } from './pricing';
import { reconcileLines } from './reconcile';

const rule = { shipping_fee: 3000, free_shipping_threshold: 100000 };

describe('shippingFeeFor', () => {
  it('charges the flat fee below the threshold', () => {
    expect(shippingFeeFor(99999, rule)).toBe(3000);
  });

  it('is free from the threshold', () => {
    expect(shippingFeeFor(100000, rule)).toBe(0);
    expect(shippingFeeFor(250000, rule)).toBe(0);
  });

  it('always charges the fee without a threshold', () => {
    expect(shippingFeeFor(1_000_000, { ...rule, free_shipping_threshold: null })).toBe(3000);
  });
});

describe('freeShippingRemaining', () => {
  it('returns the missing amount below the threshold', () => {
    expect(freeShippingRemaining(59000, rule)).toBe(41000);
  });

  it('returns null at or above the threshold', () => {
    expect(freeShippingRemaining(100000, rule)).toBeNull();
  });

  it('returns null without a threshold or when shipping is free anyway', () => {
    expect(freeShippingRemaining(1000, { ...rule, free_shipping_threshold: null })).toBeNull();
    expect(freeShippingRemaining(1000, { ...rule, shipping_fee: 0 })).toBeNull();
  });
});

const line = (over: Partial<CartLine> = {}): CartLine => ({
  variantId: 'v1',
  productId: 'p1',
  slug: 'coat',
  name: 'Coat',
  color: 'Black',
  size: 'M',
  unitPrice: 100000,
  imagePath: null,
  quantity: 2,
  stock: 5,
  ...over,
});

describe('reconcileLines', () => {
  it('leaves unchanged lines without notices', () => {
    const result = reconcileLines(
      [line()],
      [{ id: 'v1', stock: 5, available: true, unitPrice: 100000 }],
    );
    expect(result.notices).toEqual({});
    expect(result.lines).toEqual([line()]);
  });

  it('updates the price and stock and reports the price change', () => {
    const result = reconcileLines(
      [line()],
      [{ id: 'v1', stock: 8, available: true, unitPrice: 90000 }],
    );
    expect(result.notices).toEqual({ v1: ['price'] });
    expect(result.lines[0]).toMatchObject({ unitPrice: 90000, stock: 8, quantity: 2 });
  });

  it('lowers the quantity to the stock', () => {
    const result = reconcileLines(
      [line({ quantity: 4 })],
      [{ id: 'v1', stock: 3, available: true, unitPrice: 100000 }],
    );
    expect(result.notices).toEqual({ v1: ['quantity'] });
    expect(result.lines[0]?.quantity).toBe(3);
  });

  it('marks sold-out and missing or inactive variants', () => {
    const result = reconcileLines(
      [line(), line({ variantId: 'v2' }), line({ variantId: 'v3' })],
      [
        { id: 'v1', stock: 0, available: true, unitPrice: 100000 },
        { id: 'v3', stock: 5, available: false, unitPrice: 100000 },
      ],
    );
    expect(result.notices).toEqual({ v1: ['soldout'], v2: ['unavailable'], v3: ['unavailable'] });
    expect(result.lines[0]?.stock).toBe(0);
  });
});
