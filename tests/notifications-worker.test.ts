import { describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/internal/notifications/outbox/route';
import { runNotificationWorkerPass, type NotificationOutboxStore, type NotificationProvider, type ClaimedNotificationOutboxRecord } from '@/lib/notifications/worker';

function record(id: string): ClaimedNotificationOutboxRecord {
  return {
    id,
    status: 'processing',
    channel: 'email',
    provider: 'test',
    destination: `${id}@example.com`,
    payload: { body: `hello ${id}` },
    attempts: 0,
    max_attempts: 3,
    locked_by: 'worker-1',
    locked_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    last_error_category: null,
    last_error_code: null,
    next_attempt_at: null,
  };
}

function createStore(records: ClaimedNotificationOutboxRecord[]): NotificationOutboxStore & { sent: string[]; failed: Array<{ id: string; category: string; attempts: number }> } {
  const available = [...records];
  return {
    sent: [],
    failed: [],
    async claimPendingBatch({ limit, workerId, now }) {
      return available.splice(0, limit).map((item) => ({ ...item, locked_by: workerId, locked_at: now.toISOString() }));
    },
    async markSent({ id }) {
      this.sent.push(id);
      return true;
    },
    async markFailed({ id, category, attempts }) {
      this.failed.push({ id, category, attempts });
      return true;
    },
  };
}

function provider(results: Record<string, Awaited<ReturnType<NotificationProvider['deliver']>>>): NotificationProvider & { deliveredIds: string[] } {
  return {
    deliveredIds: [],
    async deliver(message) {
      this.deliveredIds.push(message.id);
      return results[message.id] ?? { ok: true, providerMessageId: `provider-${message.id}` };
    },
  };
}

describe('notification outbox worker', () => {
  it('delivers a successful bounded batch and marks records sent', async () => {
    const store = createStore([record('one'), record('two'), record('three')]);
    const testProvider = provider({});

    const result = await runNotificationWorkerPass({ store, provider: testProvider, workerId: 'worker-1', batchSize: 2, now: () => new Date('2026-01-01T00:00:00.000Z') });

    expect(result).toMatchObject({ claimed: 2, delivered: 2, transientFailures: 0, permanentFailures: 0 });
    expect(store.sent).toEqual(['one', 'two']);
    expect(testProvider.deliveredIds).toEqual(['one', 'two']);
  });

  it('updates partial transient and permanent failures without stopping the batch', async () => {
    const store = createStore([record('ok'), record('retry'), record('bad')]);
    const testProvider = provider({
      retry: { ok: false, category: 'transient', code: 'rate_limited' },
      bad: { ok: false, category: 'permanent', code: 'invalid_template' },
    });

    const result = await runNotificationWorkerPass({ store, provider: testProvider, workerId: 'worker-1', batchSize: 10, now: () => new Date('2026-01-01T00:00:00.000Z') });

    expect(result).toMatchObject({ claimed: 3, delivered: 1, transientFailures: 1, permanentFailures: 1 });
    expect(store.sent).toEqual(['ok']);
    expect(store.failed).toEqual([
      { id: 'retry', category: 'transient', attempts: 1 },
      { id: 'bad', category: 'permanent', attempts: 1 },
    ]);
  });

  it('does not count stale concurrent claims as successful delivery', async () => {
    const store = createStore([record('stale')]);
    store.markSent = vi.fn(async () => false);

    const result = await runNotificationWorkerPass({ store, provider: provider({}), workerId: 'worker-1', batchSize: 10, now: () => new Date('2026-01-01T00:00:00.000Z') });

    expect(result.delivered).toBe(0);
    expect(store.markSent).toHaveBeenCalledWith(expect.objectContaining({ id: 'stale', workerId: 'worker-1' }));
  });

  it('enforces invalid worker authorization before invoking the route worker', async () => {
    process.env.NOTIFICATION_WORKER_SECRET = 'secret';
    const response = await POST(new Request('http://localhost/api/internal/notifications/outbox', { method: 'POST', headers: { authorization: 'Bearer wrong' } }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'unauthorized' });
  });

  it('stops delivery at the execution-time boundary', async () => {
    const store = createStore([record('first'), record('second')]);
    const times = [0, 0, 2_000, 2_000, 2_000].map((ms) => new Date(Date.parse('2026-01-01T00:00:00.000Z') + ms));

    const result = await runNotificationWorkerPass({ store, provider: provider({}), workerId: 'worker-1', batchSize: 10, maxDurationMs: 1_000, now: () => times.shift() ?? new Date('2026-01-01T00:00:02.000Z') });

    expect(result).toMatchObject({ claimed: 2, delivered: 1, skippedByBoundary: 1 });
    expect(store.sent).toEqual(['first']);
  });

  it('logs only safe ids, counts, categories, statuses, and durations', async () => {
    const logs: unknown[] = [];
    await runNotificationWorkerPass({ store: createStore([record('safe-id')]), provider: provider({ 'safe-id': { ok: false, category: 'transient', code: 'rate_limited' } }), workerId: 'worker-1', batchSize: 10, now: () => new Date('2026-01-01T00:00:00.000Z'), logSink: (entry) => logs.push(entry) });

    const serialized = JSON.stringify(logs);
    expect(serialized).toContain('safe-id');
    expect(serialized).toContain('transient');
    expect(serialized).not.toContain('safe-id@example.com');
    expect(serialized).not.toContain('hello safe-id');
  });
});
