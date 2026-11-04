import { describe, expect, it } from 'vitest';
import { cancelRequestSchema, checkoutSchema } from './schemas';

const newAddress = {
  label: '',
  recipient: ' 홍길동 ',
  phone: '010-1234-5678',
  postalCode: '06236',
  address1: '서울 강남구 테헤란로 152',
  address2: '',
  isDefault: false,
};

const valid = {
  shipping: { addressId: '0b6f2c1e-5d0a-4c3f-9a51-2f6a7f3b8c10' },
  memo: '',
  depositorName: ' 홍길동 ',
  agree: true,
};

function issuePaths(result: { error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((issue) => issue.path.join('.')) ?? [];
}

describe('checkoutSchema', () => {
  it('accepts a saved address id and trims the depositor name', () => {
    expect(checkoutSchema.parse(valid)).toEqual({ ...valid, depositorName: '홍길동' });
  });

  it('accepts a new address and normalises it', () => {
    const parsed = checkoutSchema.parse({ ...valid, shipping: newAddress });
    expect(parsed.shipping).toEqual({ ...newAddress, recipient: '홍길동', phone: '01012345678' });
  });

  it('requires a shipping destination', () => {
    const result = checkoutSchema.safeParse({ ...valid, shipping: undefined });
    expect(issuePaths(result)).toEqual(['shipping']);
    expect(result.error?.issues[0]?.message).toBe('배송지를 선택하세요');
  });

  it('rejects an address id that is not a uuid', () => {
    const result = checkoutSchema.safeParse({ ...valid, shipping: { addressId: '1' } });
    expect(issuePaths(result)).toEqual(['shipping.addressId']);
  });

  it('requires agreement', () => {
    expect(issuePaths(checkoutSchema.safeParse({ ...valid, agree: false }))).toEqual(['agree']);
  });

  it('limits the depositor name to 1–20 characters and the memo to 200', () => {
    expect(issuePaths(checkoutSchema.safeParse({ ...valid, depositorName: '   ' }))).toEqual([
      'depositorName',
    ]);
    expect(
      issuePaths(checkoutSchema.safeParse({ ...valid, depositorName: '가'.repeat(21) })),
    ).toEqual(['depositorName']);
    expect(checkoutSchema.safeParse({ ...valid, memo: 'a'.repeat(200) }).success).toBe(true);
    expect(issuePaths(checkoutSchema.safeParse({ ...valid, memo: 'a'.repeat(201) }))).toEqual([
      'memo',
    ]);
  });
});

describe('cancelRequestSchema', () => {
  it('requires a trimmed reason up to 200 characters', () => {
    expect(cancelRequestSchema.parse({ reason: ' 단순 변심 ' })).toEqual({ reason: '단순 변심' });
    expect(cancelRequestSchema.safeParse({ reason: '  ' }).success).toBe(false);
    expect(cancelRequestSchema.safeParse({ reason: 'a'.repeat(201) }).success).toBe(false);
  });
});
