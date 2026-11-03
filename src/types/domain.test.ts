import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES, ORDER_TRANSITIONS } from './domain';

describe('ORDER_TRANSITIONS', () => {
  it('matches the server state machine (docs/PLAN.md 6.5)', () => {
    expect(ORDER_TRANSITIONS).toEqual({
      pending_payment: ['paid', 'cancelled'],
      paid: ['preparing', 'shipped', 'cancelled'],
      preparing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: [],
      cancelled: ['refunded'],
      refunded: [],
    });
  });

  it('only targets known statuses', () => {
    for (const targets of Object.values(ORDER_TRANSITIONS)) {
      for (const target of targets) expect(ORDER_STATUSES).toContain(target);
    }
  });
});
