import { MAX_LINE_QTY, type CartLine } from '@/features/cart/store';

/** A cart variant as the database sees it now. */
export type FreshVariant = {
  id: string;
  stock: number;
  /** Variant active and its product on sale. */
  available: boolean;
  unitPrice: number;
};

/**
 * What changed since the line was added. `soldout` and `unavailable` block the order; `price` and
 * `quantity` are informational (the line was already updated).
 */
export type LineNotice = 'price' | 'quantity' | 'soldout' | 'unavailable';

export const BLOCKING_NOTICES: readonly LineNotice[] = ['soldout', 'unavailable'];

export const LINE_NOTICE_TEXT: Record<LineNotice, string> = {
  price: '가격이 변경되었습니다',
  quantity: '재고에 맞춰 수량을 변경했습니다',
  soldout: '품절',
  unavailable: '판매 중이 아닌 상품입니다',
};

/**
 * Brings cart lines in line with current prices and stock (PLAN ⑩). Missing variants (product no
 * longer active) and sold-out variants keep their line but get a blocking notice.
 */
export function reconcileLines(
  lines: CartLine[],
  fresh: FreshVariant[],
): { lines: CartLine[]; notices: Record<string, LineNotice[]> } {
  const byId = new Map(fresh.map((variant) => [variant.id, variant]));
  const notices: Record<string, LineNotice[]> = {};
  const next = lines.map((line) => {
    const variant = byId.get(line.variantId);
    if (!variant || !variant.available) {
      notices[line.variantId] = ['unavailable'];
      return line;
    }
    const lineNotices: LineNotice[] = [];
    let { quantity } = line;
    if (variant.stock < 1) {
      lineNotices.push('soldout');
    } else if (quantity > variant.stock) {
      quantity = Math.min(variant.stock, MAX_LINE_QTY);
      lineNotices.push('quantity');
    }
    if (variant.unitPrice !== line.unitPrice) lineNotices.push('price');
    if (lineNotices.length > 0) notices[line.variantId] = lineNotices;
    return { ...line, quantity, stock: variant.stock, unitPrice: variant.unitPrice };
  });
  return { lines: next, notices };
}
