import { z } from 'zod';
import {
  emailSchema,
  nameSchema,
  optionalPhoneSchema,
  passwordSchema,
  phoneSchema,
} from '@/features/auth/schemas';

export const addressSchema = z.object({
  label: z.string().trim().max(20, '20자 이내로 입력하세요'),
  recipient: z.string().trim().min(1, '받는 분을 입력하세요').max(40, '40자 이내로 입력하세요'),
  phone: phoneSchema,
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, '주소를 검색하세요'),
  address1: z.string().trim().min(1, '주소를 검색하세요').max(120, '120자 이내로 입력하세요'),
  address2: z.string().trim().max(120, '120자 이내로 입력하세요'),
  isDefault: z.boolean(),
});
/** Form field values (before trimming / phone normalisation). */
export type AddressFormInput = z.input<typeof addressSchema>;
/** Validated address: trimmed, phone digits only. */
export type AddressInput = z.output<typeof addressSchema>;

export const profileSchema = z.object({
  name: nameSchema,
  phone: optionalPhoneSchema,
  marketingAgreed: z.boolean(),
});
export type ProfileFormInput = z.input<typeof profileSchema>;
export type ProfileValues = z.output<typeof profileSchema>;

export const changeEmailSchema = z.object({ email: emailSchema });
export type ChangeEmailValues = z.output<typeof changeEmailSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '현재 비밀번호를 입력하세요'),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 일치하지 않습니다',
  });
export type ChangePasswordValues = z.output<typeof changePasswordSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().min(1, '비밀번호를 입력하세요'),
});
export type DeleteAccountValues = z.output<typeof deleteAccountSchema>;
