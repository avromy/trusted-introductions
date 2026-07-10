import { describe, expect, it } from 'vitest';
import { calculateRetryDecision } from '@/lib/notifications/retry';

describe('notification retry policy', () => {
  it('uses capped exponential backoff', () => {
    const now = new Date('2026-07-10T00:00:00.000Z');
    expect(calculateRetryDecision({ attemptCount: 1, failure: 'transient', now })).toEqual({
      action: 'retry', nextAttemptAt: new Date('2026-07-10T00:01:00.000Z'),
    });
  });
  it('dead letters permanent and exhausted failures', () => {
    expect(calculateRetryDecision({ attemptCount: 1, failure: 'permanent' }).action).toBe('dead_letter');
    expect(calculateRetryDecision({ attemptCount: 5, failure: 'transient' }).action).toBe('dead_letter');
  });
});
