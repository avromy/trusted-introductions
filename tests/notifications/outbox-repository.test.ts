import { describe, expect, it, vi } from 'vitest';

import {
  claimPendingNotifications,
  enqueueNotification,
  getNotificationById,
  getNotificationByIdempotencyKey,
  mapOutboxRow,
  markNotificationFailed,
  markNotificationSent,
  normalizeOutboxInput,
  type NotificationOutboxRepositoryClient,
  type NotificationOutboxRow,
} from '@/lib/notifications/outbox';

const NOW = new Date('2026-07-10T12:00:00.000Z');

function row(overrides: Partial<NotificationOutboxRow> = {}): NotificationOutboxRow {
  return {
    id: 'outbox-1',
    category: 'invite.created',
    recipient_identity_id: 'identity-1',
    channel: 'email',
    destination_ref: 'identity:identity-1:primary_email',
    template_payload: { inviteId: 'invite-1' },
    metadata: { communityId: 'community-1' },
    idempotency_key: 'invite.created:invite-1',
    status: 'pending',
    attempt_count: 0,
    next_attempt_at: NOW.toISOString(),
    sent_at: null,
    failure_classification: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function createClient(resultRows: NotificationOutboxRow[] = [row()]) {
  const calls: Array<{ action: string; payload?: unknown; column?: string; value?: unknown; values?: unknown[]; count?: number }> = [];
  let maybeSingleResult: NotificationOutboxRow | null = resultRows[0] ?? null;
  let singleResult: NotificationOutboxRow = resultRows[0] ?? row();

  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn((payload: unknown) => {
      calls.push({ action: 'insert', payload });
      singleResult = row(payload as Partial<NotificationOutboxRow>);
      return builder;
    }),
    update: vi.fn((payload: unknown) => {
      calls.push({ action: 'update', payload });
      singleResult = row(payload as Partial<NotificationOutboxRow>);
      return builder;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      calls.push({ action: 'eq', column, value });
      return builder;
    }),
    in: vi.fn((column: string, values: unknown[]) => {
      calls.push({ action: 'in', column, values });
      return builder;
    }),
    lte: vi.fn((column: string, value: unknown) => {
      calls.push({ action: 'lte', column, value });
      return builder;
    }),
    order: vi.fn((column: string) => {
      calls.push({ action: 'order', column });
      return builder;
    }),
    limit: vi.fn((count: number) => {
      calls.push({ action: 'limit', count });
      return Promise.resolve({ data: resultRows, error: null });
    }),
    single: vi.fn(async () => ({ data: singleResult, error: null })),
    maybeSingle: vi.fn(async () => ({ data: maybeSingleResult, error: null })),
  };

  const client = { from: vi.fn(() => builder) } as unknown as NotificationOutboxRepositoryClient;
  return { client, calls, builder, setMaybeSingle: (value: NotificationOutboxRow | null) => { maybeSingleResult = value; } };
}

describe('notification outbox normalization and mapping', () => {
  it('normalizes enqueue input into provider-neutral persistence fields', () => {
    expect(normalizeOutboxInput({
      category: ' invite.created ',
      recipientIdentityId: ' identity-1 ',
      channel: 'email',
      destinationRef: ' identity:identity-1:primary_email ',
      idempotencyKey: ' invite.created:invite-1 ',
      templatePayload: { inviteId: 'invite-1' },
      metadata: { communityId: 'community-1' },
      nextAttemptAt: NOW,
    })).toEqual({
      category: 'invite.created',
      recipient_identity_id: 'identity-1',
      channel: 'email',
      destination_ref: 'identity:identity-1:primary_email',
      template_payload: { inviteId: 'invite-1' },
      metadata: { communityId: 'community-1' },
      idempotency_key: 'invite.created:invite-1',
      next_attempt_at: NOW.toISOString(),
    });
  });

  it('rejects missing durable identity fields', () => {
    expect(() => normalizeOutboxInput({ category: ' ', channel: 'email', destinationRef: 'dest', idempotencyKey: 'key' })).toThrow('category');
    expect(() => normalizeOutboxInput({ category: 'cat', channel: 'email', destinationRef: ' ', idempotencyKey: 'key' })).toThrow('destination');
    expect(() => normalizeOutboxInput({ category: 'cat', channel: 'email', destinationRef: 'dest', idempotencyKey: ' ' })).toThrow('idempotency');
  });

  it('maps database rows to camel-case records', () => {
    expect(mapOutboxRow(row({ status: 'failed', failure_classification: 'transient' }))).toMatchObject({
      recipientIdentityId: 'identity-1',
      destinationRef: 'identity:identity-1:primary_email',
      idempotencyKey: 'invite.created:invite-1',
      failureClassification: 'transient',
    });
  });
});

describe('notification outbox repository behavior', () => {
  it('enqueues rows with idempotency protection fields intact', async () => {
    const { client, calls } = createClient();
    await enqueueNotification({ category: 'invite.created', recipientIdentityId: 'identity-1', channel: 'email', destinationRef: 'dest', idempotencyKey: 'key' }, client);
    expect(calls[0]).toMatchObject({ action: 'insert', payload: { category: 'invite.created', idempotency_key: 'key' } });
    expect(calls[0].payload).not.toHaveProperty('status');
  });

  it('looks up by id and idempotency key', async () => {
    const { client, calls, setMaybeSingle } = createClient();
    await expect(getNotificationById(' outbox-1 ', client)).resolves.toMatchObject({ id: 'outbox-1' });
    setMaybeSingle(null);
    await expect(getNotificationByIdempotencyKey(' missing ', client)).resolves.toBeNull();
    expect(calls).toContainEqual({ action: 'eq', column: 'id', value: 'outbox-1' });
    expect(calls).toContainEqual({ action: 'eq', column: 'idempotency_key', value: 'missing' });
  });

  it('claims pending records due for delivery', async () => {
    const { client, calls } = createClient([row({ status: 'processing', attempt_count: 1 })]);
    await expect(claimPendingNotifications(5, NOW, client)).resolves.toHaveLength(1);
    expect(calls).toContainEqual({ action: 'update', payload: { status: 'processing', attempt_count: 1 } });
    expect(calls).toContainEqual({ action: 'in', column: 'status', values: ['pending', 'failed'] });
    expect(calls).toContainEqual({ action: 'lte', column: 'next_attempt_at', value: NOW.toISOString() });
    expect(calls).toContainEqual({ action: 'limit', count: 5 });
  });

  it('marks records sent or failed without provider-specific fields', async () => {
    const { client, calls } = createClient();
    await markNotificationSent(' outbox-1 ', NOW, client);
    await markNotificationFailed(' outbox-1 ', 'rate_limited', NOW, client);
    expect(calls).toContainEqual({ action: 'update', payload: { status: 'sent', sent_at: NOW.toISOString(), failure_classification: null } });
    expect(calls).toContainEqual({ action: 'update', payload: { status: 'failed', failure_classification: 'rate_limited', next_attempt_at: NOW.toISOString() } });
  });
});
