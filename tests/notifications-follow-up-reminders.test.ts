import { describe, expect, it, vi } from 'vitest';

import {
  buildSafeFollowUpReminderNotification,
  identifyDueFollowUpReminder,
  queueDueFollowUpReminderNotifications,
  type FollowUpReminderAuditClient,
  type FollowUpReminderNotification,
  type FollowUpReminderOutboxClient,
  type PersistedFollowUpReminderOccurrence,
} from '@/lib/notifications/follow-up';

const NOW = new Date('2026-07-10T12:00:00.000Z');

const introduction = {
  id: 'intro-123',
  requesterIdentityId: 'identity-seeker',
  helperIdentityId: 'identity-helper',
  createdByIdentityId: 'identity-steward',
};

const steward = {
  id: 'identity-steward',
  roles: [{ role: 'steward' as const, community_id: null }],
};

function reminder(overrides: Partial<PersistedFollowUpReminderOccurrence> = {}): PersistedFollowUpReminderOccurrence {
  return {
    id: 'reminder-123',
    introductionId: 'intro-123',
    stewardIdentityId: 'identity-steward',
    remindAt: '2026-07-10T11:00:00.000Z',
    recipientIdentityIds: ['identity-seeker', 'identity-helper'],
    status: 'scheduled',
    createdAt: '2026-07-08T12:00:00.000Z',
    ...overrides,
  };
}

function createClient(options: { duplicate?: boolean } = {}) {
  const outboxRows: FollowUpReminderNotification[] = [];
  const auditRows: unknown[] = [];
  const outboxInsert = vi.fn(async (payload: FollowUpReminderNotification) => {
    if (options.duplicate) return { error: new Error('duplicate key value violates unique constraint') };
    outboxRows.push(payload);
    return { error: null };
  });
  const auditInsert = vi.fn(async (payload: unknown) => {
    auditRows.push(payload);
    return { error: null };
  });

  return {
    outboxRows,
    auditRows,
    outboxInsert,
    auditInsert,
    client: {
      from: vi.fn((table: 'notification_outbox' | 'audit_events') => {
        if (table === 'notification_outbox') return { insert: outboxInsert };
        return { insert: auditInsert };
      }),
    } as unknown as FollowUpReminderOutboxClient & FollowUpReminderAuditClient,
  };
}

describe('follow-up reminder notification orchestration', () => {
  it('does not identify not-due reminders', () => {
    expect(
      identifyDueFollowUpReminder(reminder({ remindAt: '2026-07-10T13:00:00.000Z' }), {
        now: NOW,
      }),
    ).toBeNull();
  });

  it('queues due reminder notifications through the outbox and records the occurrence', async () => {
    const { client, outboxRows, auditRows } = createClient();

    await expect(
      queueDueFollowUpReminderNotifications(client, {
        reminder: reminder(),
        introduction,
        actorIdentity: steward,
        now: NOW,
      }),
    ).resolves.toEqual({
      queued: 2,
      suppressed: 0,
      idempotencyKeys: [
        'introduction-follow-up-reminder:reminder-123:identity-seeker',
        'introduction-follow-up-reminder:reminder-123:identity-helper',
      ],
    });

    expect(outboxRows).toHaveLength(2);
    expect(auditRows).toEqual([
      expect.objectContaining({
        event_type: 'introduction_follow_up_reminder.queued',
        actor_identity_id: 'identity-steward',
        subject_id: 'intro-123',
        metadata: expect.objectContaining({ recipientCount: 2, status: 'queued' }),
      }),
    ]);
  });

  it('suppresses duplicate outbox notifications by idempotency key', async () => {
    const { client, outboxInsert, auditInsert } = createClient({ duplicate: true });

    await expect(
      queueDueFollowUpReminderNotifications(client, {
        reminder: reminder(),
        introduction,
        actorIdentity: steward,
        now: NOW,
      }),
    ).resolves.toMatchObject({ queued: 0, suppressed: 2 });

    expect(outboxInsert).toHaveBeenCalledTimes(2);
    expect(auditInsert).not.toHaveBeenCalled();
  });

  it('ignores completed or skipped reminders', async () => {
    const { client, outboxInsert, auditInsert } = createClient();

    await expect(
      queueDueFollowUpReminderNotifications(client, {
        reminder: reminder({ status: 'completed' }),
        introduction,
        actorIdentity: steward,
        now: NOW,
      }),
    ).resolves.toEqual({ queued: 0, suppressed: 0, idempotencyKeys: [] });
    await expect(
      queueDueFollowUpReminderNotifications(client, {
        reminder: reminder({ status: 'canceled' }),
        introduction,
        actorIdentity: steward,
        now: NOW,
      }),
    ).resolves.toEqual({ queued: 0, suppressed: 0, idempotencyKeys: [] });

    expect(outboxInsert).not.toHaveBeenCalled();
    expect(auditInsert).not.toHaveBeenCalled();
  });

  it('blocks unauthorized actors before queueing', async () => {
    const { client, outboxInsert } = createClient();

    await expect(
      queueDueFollowUpReminderNotifications(client, {
        reminder: reminder(),
        introduction,
        actorIdentity: { id: 'identity-outsider', roles: [{ role: 'member' as const, community_id: null }] },
        now: NOW,
      }),
    ).rejects.toThrow('You are not authorized to perform this action.');
    expect(outboxInsert).not.toHaveBeenCalled();
  });

  it('excludes private reminder notes from notification content and metadata', () => {
    const privateNote = 'Private note: ask about salary expectations.';
    const notification = buildSafeFollowUpReminderNotification({
      reminder: reminder(),
      introduction,
      recipientIdentityId: 'identity-seeker',
    });

    expect(JSON.stringify(notification)).not.toContain(privateNote);
    expect(notification.payload).toEqual({
      introductionId: 'intro-123',
      reminderId: 'reminder-123',
      remindAt: '2026-07-10T11:00:00.000Z',
    });
    expect(notification.provider_metadata).toEqual({
      idempotencyKey: 'introduction-follow-up-reminder:reminder-123:identity-seeker',
      template: 'introduction_follow_up_reminder',
    });
  });
});
