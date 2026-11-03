import { describe, expect, it } from 'vitest';
import { FALLBACK_ERROR_MESSAGE, rpcErrorCode, rpcErrorDetail, rpcErrorMessage } from './rpcErrors';

describe('rpcErrors', () => {
  it('maps known server codes to Korean messages', () => {
    expect(rpcErrorMessage({ message: 'OUT_OF_STOCK', details: 'v1' })).toBe(
      '재고가 부족한 상품이 있습니다',
    );
    expect(rpcErrorCode({ message: 'FORBIDDEN' })).toBe('FORBIDDEN');
    expect(rpcErrorDetail({ message: 'OUT_OF_STOCK', details: 'v1' })).toBe('v1');
  });

  it('never surfaces raw database messages', () => {
    const error = { message: 'duplicate key value violates unique constraint "orders_pkey"' };
    expect(rpcErrorMessage(error)).toBe(FALLBACK_ERROR_MESSAGE);
    expect(rpcErrorMessage(null)).toBe(FALLBACK_ERROR_MESSAGE);
    expect(rpcErrorCode(new Error('toString'))).toBeNull();
    expect(rpcErrorDetail({ message: 'X', details: '' })).toBeNull();
  });
});
