import { describe, expect, it } from 'vitest';
import {
  loginSchema,
  newPasswordSchema,
  optionalPhoneSchema,
  passwordSchema,
  phoneSchema,
  signupSchema,
} from './schemas';

const validSignup = {
  email: ' user@example.com ',
  password: 'abcd1234',
  passwordConfirm: 'abcd1234',
  name: ' 홍길동 ',
  phone: '010-1234-5678',
  termsAgreed: true,
  privacyAgreed: true,
  marketingAgreed: false,
};

function issuePaths(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((issue) => issue.path.join('.')) ?? [];
}

describe('passwordSchema (config.toml: 8+ chars, letters_digits)', () => {
  it.each(['abcd1234', 'A1bcdefg', '12345678a'])('accepts %s', (value) => {
    expect(passwordSchema.safeParse(value).success).toBe(true);
  });

  it.each(['abc123', 'abcdefgh', '12345678', ''])('rejects %s', (value) => {
    expect(passwordSchema.safeParse(value).success).toBe(false);
  });

  it('rejects passwords over 72 bytes', () => {
    expect(passwordSchema.safeParse(`a1${'가'.repeat(24)}`).success).toBe(false);
    expect(passwordSchema.safeParse(`a1${'x'.repeat(70)}`).success).toBe(true);
  });
});

describe('phone schemas', () => {
  it('strips hyphens and spaces', () => {
    expect(phoneSchema.parse('010-1234-5678')).toBe('01012345678');
    expect(phoneSchema.parse('011 123 4567')).toBe('0111234567');
  });

  it.each(['0212345678', '010123', '010-1234-56789', 'abc'])('rejects %s', (value) => {
    expect(phoneSchema.safeParse(value).success).toBe(false);
  });

  it('optional phone turns blank into null', () => {
    expect(optionalPhoneSchema.parse('')).toBeNull();
    expect(optionalPhoneSchema.parse(' - ')).toBeNull();
    expect(optionalPhoneSchema.parse('01012345678')).toBe('01012345678');
    expect(optionalPhoneSchema.safeParse('123').success).toBe(false);
  });
});

describe('signupSchema', () => {
  it('accepts a valid form and normalises values', () => {
    expect(signupSchema.parse(validSignup)).toEqual({
      ...validSignup,
      email: 'user@example.com',
      name: '홍길동',
      phone: '01012345678',
    });
  });

  it('requires both mandatory consents', () => {
    const result = signupSchema.safeParse({
      ...validSignup,
      termsAgreed: false,
      privacyAgreed: false,
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(expect.arrayContaining(['termsAgreed', 'privacyAgreed']));
  });

  it('does not require marketing consent', () => {
    expect(signupSchema.safeParse({ ...validSignup, marketingAgreed: true }).success).toBe(true);
  });

  it('flags a mismatched confirmation on passwordConfirm', () => {
    const result = signupSchema.safeParse({ ...validSignup, passwordConfirm: 'abcd12345' });
    expect(issuePaths(result)).toEqual(['passwordConfirm']);
  });

  it('rejects a bad email, empty name and a 41-character name', () => {
    expect(issuePaths(signupSchema.safeParse({ ...validSignup, email: 'user@' }))).toEqual([
      'email',
    ]);
    expect(issuePaths(signupSchema.safeParse({ ...validSignup, name: '  ' }))).toEqual(['name']);
    expect(issuePaths(signupSchema.safeParse({ ...validSignup, name: 'a'.repeat(41) }))).toEqual([
      'name',
    ]);
  });
});

describe('loginSchema / newPasswordSchema', () => {
  it('login only needs a non-empty password (no policy hint on login)', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });

  it('new password must follow the policy and match', () => {
    expect(
      newPasswordSchema.safeParse({ password: 'abcd1234', passwordConfirm: 'abcd1234' }).success,
    ).toBe(true);
    expect(
      issuePaths(newPasswordSchema.safeParse({ password: 'abcd1234', passwordConfirm: 'x' })),
    ).toEqual(['passwordConfirm']);
  });
});
