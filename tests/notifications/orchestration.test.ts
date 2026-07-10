import { describe, expect, it, vi } from 'vitest';
import { queueInviteDeliveryNotification, queueIntroductionCoordinationNotifications } from '@/lib/notifications/orchestration';
import type { NotificationOutboxRepositoryClient } from '@/lib/notifications/outbox';

function client() {
  const rows: unknown[] = [];
  const builder: any = {
    insert: vi.fn((payload) => { rows.push(payload); return builder; }),
    select: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: {
      id: `outbox-${rows.length}`, status: 'pending', attempt_count: 0, sent_at: null,
      failure_classification: null, created_at: '2026-07-10T00:00:00.000Z', updated_at: '2026-07-10T00:00:00.000Z',
      ...(rows.at(-1) as object),
    }, error: null })),
  };
  return { rows, client: { from: vi.fn(() => builder) } as unknown as NotificationOutboxRepositoryClient };
}

describe('notification orchestration', () => {
  it('queues invite delivery without putting the plaintext token in metadata', async () => {
    const test = client();
    await queueInviteDeliveryNotification(test.client, {
      inviteId: 'invite-1', inviteeEmail: 'person@example.com',
      acceptUrl: 'https://app.example.test/onboarding/invite?token=secret-token',
    });
    const row = test.rows[0] as any;
    expect(row.idempotency_key).toBe('invite-delivery:invite-1:created');
    expect(JSON.stringify(row.metadata)).not.toContain('secret-token');
  });

  it('queues separate requester and helper coordination messages', async () => {
    const test = client();
    await queueIntroductionCoordinationNotifications(test.client, {
      introductionId: 'intro-1', requesterIdentityId: 'requester-1', helperIdentityId: 'helper-1',
      introductionUrl: 'https://app.example.test/introductions/intro-1',
    });
    expect(test.rows).toHaveLength(2);
    expect(test.rows.map((row: any) => row.idempotency_key)).toEqual([
      'introduction-coordination:intro-1:requester',
      'introduction-coordination:intro-1:helper',
    ]);
  });
});
