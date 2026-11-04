import { z } from 'zod';

/** Mirrors supabase/config.toml: minimum_password_length = 8, password_requirements = "letters_digits". */
export const PASSWORD_RULE = '영문과 숫자를 포함해 8자 이상';

export const emailSchema = z
  .string()
  .trim()
  .min(1, '이메일을 입력하세요')
  .pipe(z.email('이메일 형식이 아닙니다'));

export const passwordSchema = z
  .string()
  .min(8, PASSWORD_RULE)
  // bcrypt reads at most 72 bytes; longer passwords would be silently truncated.
  .refine((value) => new TextEncoder().encode(value).length <= 72, '비밀번호가 너무 깁니다')
  .regex(/[A-Za-z]/, PASSWORD_RULE)
  .regex(/[0-9]/, PASSWORD_RULE);

export const nameSchema = z
  .string()
  .trim()
  .min(1, '이름을 입력하세요')
  .max(40, '40자 이내로 입력하세요');

const PHONE_PATTERN = /^01[0-9]{8,9}$/;

/** Hyphens and spaces are stripped; the database stores digits only (profiles/addresses check). */
export const phoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(PHONE_PATTERN, '휴대폰 번호를 확인하세요'));

/** Optional phone: blank becomes null. */
export const optionalPhoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .pipe(
    z.union([
      z.literal('').transform(() => null),
      z.string().regex(PHONE_PATTERN, '휴대폰 번호를 확인하세요'),
    ]),
  );

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '비밀번호를 입력하세요'),
});
export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;

export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
    name: nameSchema,
    phone: optionalPhoneSchema,
    termsAgreed: z.literal(true, '필수 항목에 동의하세요'),
    privacyAgreed: z.literal(true, '필수 항목에 동의하세요'),
    marketingAgreed: z.boolean(),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 일치하지 않습니다',
  });
export type SignupInput = z.input<typeof signupSchema>;
export type SignupValues = z.output<typeof signupSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordValues = z.output<typeof forgotPasswordSchema>;

export const newPasswordSchema = z
  .object({ password: passwordSchema, passwordConfirm: z.string() })
  .refine((values) => values.password === values.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 일치하지 않습니다',
  });
export type NewPasswordValues = z.output<typeof newPasswordSchema>;
