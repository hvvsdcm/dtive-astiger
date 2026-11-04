import { describe, expect, it } from 'vitest';
import { addressSchema, changePasswordSchema, profileSchema } from './schemas';

const validAddress = {
  label: ' 집 ',
  recipient: ' 홍길동 ',
  phone: '010-1234-5678',
  postalCode: '06236',
  address1: '서울 강남구 테헤란로 152',
  address2: '12층',
  isDefault: true,
};

function issuePaths(result: { error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((issue) => issue.path.join('.')) ?? [];
}

describe('addressSchema', () => {
  it('trims text and normalises the phone to digits', () => {
    expect(addressSchema.parse(validAddress)).toEqual({
      ...validAddress,
      label: '집',
      recipient: '홍길동',
      phone: '01012345678',
    });
  });

  it('allows an empty label and detail address', () => {
    expect(addressSchema.safeParse({ ...validAddress, label: '', address2: '' }).success).toBe(
      true,
    );
  });

  it.each([
    ['postalCode', '1234'],
    ['postalCode', 'abcde'],
    ['address1', ''],
    ['recipient', ''],
    ['recipient', 'a'.repeat(41)],
    ['label', 'a'.repeat(21)],
    ['address2', 'a'.repeat(121)],
    ['phone', '02-123-4567'],
  ])('rejects %s = %j', (field, value) => {
    expect(issuePaths(addressSchema.safeParse({ ...validAddress, [field]: value }))).toEqual([
      field,
    ]);
  });
});

describe('profileSchema', () => {
  it('blank phone becomes null', () => {
    expect(profileSchema.parse({ name: '홍길동', phone: '', marketingAgreed: false })).toEqual({
      name: '홍길동',
      phone: null,
      marketingAgreed: false,
    });
  });
});

describe('changePasswordSchema', () => {
  it('needs the current password and a matching new one', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'old',
        password: 'abcd1234',
        passwordConfirm: 'abcd1234',
      }).success,
    ).toBe(true);
    expect(
      issuePaths(
        changePasswordSchema.safeParse({
          currentPassword: '',
          password: 'abcd1234',
          passwordConfirm: 'abcd1234',
        }),
      ),
    ).toEqual(['currentPassword']);
  });
});
