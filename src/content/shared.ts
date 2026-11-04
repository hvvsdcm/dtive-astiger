import { business } from '@/config/business';
import { formatKRW } from '@/lib/format';
import type { ShopRules } from './types';

/** Shown (highlighted) wherever a business detail in src/config/business.ts is still empty. */
export const MISSING = '[사업자 정보 입력 필요]';

export const filled = (value: string) => value.trim() || MISSING;

/** Customer-service address: the dedicated one, else the company email. */
export const CS_EMAIL = filled(business.customerService.email || business.email);

/** "배송비는 3,000원이며, 상품 금액 100,000원 이상 주문은 무료입니다." */
export function shippingFeeSentence(rules: ShopRules): string {
  if (!rules) return '배송비는 주문서에 표시됩니다.';
  if (rules.shippingFee === 0) return '배송비는 무료입니다.';
  const fee = `배송비는 ${formatKRW(rules.shippingFee)}`;
  return rules.freeShippingThreshold === null
    ? `${fee}입니다.`
    : `${fee}이며, 상품 금액 ${formatKRW(rules.freeShippingThreshold)} 이상 주문은 무료입니다.`;
}

/** Payment window for bank transfers: "주문 후 48시간", or a pointer to the order screen. */
export function paymentDue(rules: ShopRules): string {
  return rules ? `주문 후 ${rules.paymentDueHours}시간` : '주문 완료 화면에 안내된 기한';
}
