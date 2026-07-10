import { describe, expect, it } from 'vitest';

import {
  applyNotificationProviderResult,
  buildFailureRecord,
  calculateRetryDelayMs,
  requeueDeadLetterNotification,
  type NotificationOutboxRetryState,
  type NotificationRetryPolicy,
} from '@/lib/notifications/retry';

const NOW = new Date('2026-07-10T12:00:00.000Z');
const policy: NotificationRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 5_000,
};

function outbox(overrides: Partial<NotificationOutboxRetryState> = {}): NotificationOutboxRetryState {
  return {
    id: 'outbox-1',
    status: 'processing',
    attemptCount: 0,
    metadata: {},
    ...overrides,
  };
}

describe('notification retry policy', () => {
  it('schedules the first retry for a transient failure', () => {
    const update = applyNotificationProviderResult(
      outbox(),
      { ok: false, retryable: true, statusCode: 503, responseText: 'provider secret body' },
      { now: NOW, policy },
    );

    expect(update).toMatchObject({
      status: 'retry_scheduled',
      attemptCount: 1,
      nextAttemptAt: '2026-07-10T12:00:01.000Z',
      failureKind: 'transient_provider',
      failureStatusCode: 503,
    });
  });

  it('caps exponential backoff at the policy maximum', () => {
    expect(calculateRetryDelayMs(4, policy, 'outbox-1')).toBe(5_000);
  });

  it('moves exhausted transient failures to dead letter at maximum attempts', () => {
    const update = applyNotificationProviderResult(
      outbox({ attemptCount: 2 }),
      { ok: false, retryable: true, statusCode: 503 },
      { now: NOW, policy },
    );

    expect(update.status).toBe('dead_letter');
    expect(update.attemptCount).toBe(3);
    expect(update.nextAttemptAt).toBeNull();
  });

  it('moves permanent failures directly to dead letter', () => {
    const update = applyNotificationProviderResult(
      outbox(),
      { ok: false, retryable: false, statusCode: 400 },
      { now: NOW, policy },
    );

    expect(update).toMatchObject({
      status: 'dead_letter',
      attemptCount: 1,
      nextAttemptAt: null,
      failureKind: 'permanent_provider',
      failureStatusCode: 400,
    });
  });

  it('records a privacy-safe dead-letter transition without raw provider text', () => {
    const record = buildFailureRecord(
      outbox({ attemptCount: 2 }),
      { ok: false, retryable: true, statusCode: 429, responseText: 'token=secret@example.com' },
      { now: NOW, policy },
    );

    expect(record.status).toBe('dead_letter');
    expect(JSON.stringify(record)).toContain('rate_limited');
    expect(JSON.stringify(record)).not.toContain('secret@example.com');
    expect(JSON.stringify(record)).not.toContain('token=');
  });

  it('allows authorized server-side operators to requeue eligible dead letters', () => {
    const result = requeueDeadLetterNotification(
      outbox({ status: 'dead_letter', attemptCount: 3, metadata: { failureKind: 'rate_limited' } }),
      { identityId: 'identity-admin', role: 'admin', serverSide: true },
      { now: NOW, reason: 'provider recovered' },
    );

    expect(result).toMatchObject({
      status: 'pending',
      attemptCount: 0,
      nextAttemptAt: null,
      metadata: {
        failureKind: 'rate_limited',
        requeuedAt: NOW.toISOString(),
        requeuedBy: 'identity-admin',
      },
    });
    expect(result.metadata?.requeueHistory).toEqual([
      {
        at: NOW.toISOString(),
        by: 'identity-admin',
        reason: 'provider recovered',
        previousAttemptCount: 3,
      },
    ]);
  });

  it('rejects unauthorized requeue attempts', () => {
    expect(() =>
      requeueDeadLetterNotification(
        outbox({ status: 'dead_letter', attemptCount: 3 }),
        { identityId: 'identity-member', role: 'member', serverSide: true },
        { now: NOW },
      ),
    ).toThrow('authorized server-side operator');
  });

  it('does not persist sensitive failure text', () => {
    const update = applyNotificationProviderResult(
      outbox(),
      {
        ok: false,
        retryable: true,
        statusCode: 500,
        responseText: 'raw SMTP response for jane@example.com',
      },
      { now: NOW, policy },
    );

    expect(JSON.stringify(update)).not.toContain('jane@example.com');
    expect(JSON.stringify(update)).not.toContain('raw SMTP response');
  });
});
