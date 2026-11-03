import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatKRW } from './format';

describe('formatKRW', () => {
  it('groups thousands and appends 원', () => {
    expect(formatKRW(129000)).toBe('129,000원');
    expect(formatKRW(0)).toBe('0원');
    expect(formatKRW(1234567)).toBe('1,234,567원');
  });
});

describe('formatDate / formatDateTime', () => {
  it('renders in Asia/Seoul regardless of the host time zone', () => {
    // 2026-03-01 15:30 UTC = 2026-03-02 00:30 KST
    expect(formatDate('2026-03-01T15:30:00Z')).toBe('2026.03.02');
    expect(formatDateTime('2026-03-01T15:30:00Z')).toBe('2026.03.02 00:30');
  });

  it('zero-pads month, day, hour and minute', () => {
    expect(formatDateTime('2026-01-04T23:05:00+09:00')).toBe('2026.01.04 23:05');
  });
});
