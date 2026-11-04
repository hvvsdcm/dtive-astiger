import { z } from 'zod';
import { addressSchema } from '@/features/account/schemas';

/** Shipping destination: a saved address (by id) or a new address typed at checkout. */
const shippingSchema = z.union([z.object({ addressId: z.uuid() }), addressSchema], {
  error: '배송지를 선택하세요',
});

export const checkoutSchema = z.object({
  shipping: shippingSchema,
  memo: z.string().trim().max(200, '200자 이내로 입력하세요'),
  depositorName: z
    .string()
    .trim()
    .min(1, '입금자명을 입력하세요')
    .max(20, '20자 이내로 입력하세요'),
  agree: z.literal(true, '주문 내용을 확인하고 동의하세요'),
});
export type CheckoutFormInput = z.input<typeof checkoutSchema>;
export type CheckoutValues = z.output<typeof checkoutSchema>;

export const cancelRequestSchema = z.object({
  reason: z.string().trim().min(1, '사유를 입력하세요').max(200, '200자 이내로 입력하세요'),
});
export type CancelRequestValues = z.output<typeof cancelRequestSchema>;
