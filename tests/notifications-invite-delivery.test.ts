import { describe, expect, it } from 'vitest';

import {
  buildInviteDeliveryIdempotencyKey,
  createInviteDeliveryOutboxPayload,
  enqueueInviteDeliveryNotification,
  inviteDeliveryPayloadContainsPlaintextToken,
  type InviteDeliveryNotificationClient,
  type InviteDeliveryOutboxPayload,
} from '@/lib/notifications/invite';

const NOW = new Date('2026-07-07T12:00:00.000Z');
const TOKEN = 'plaintext-token-for-email-only';

function createClient(options: { duplicate?: boolean } = {}) {
  const inserted: InviteDeliveryOutboxPayload[] = [];
  const existing = { id: 'notification-existing', idempotency_key: 'invite-delivery:invite-123:created' };

  const client = {
    from: (table: 'notification_outbox') => ({
      insert: (payload: InviteDeliveryOutboxPayload) => {
        inserted.push(payload);
        return {
          select: (columns: 'id,idempotency_key') => ({
            maybeSingle: async () =>
              options.duplicate
                ? { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
                : { data: { id: 'notification-123', idempotency_key: payload.idempotency_key }, error: null },
          }),
        };
      },
      select: (columns: 'id,idempotency_key') => ({
        eq: (column: 'idempotency_key', value: string) => ({
          maybeSingle: async () => ({ data: value === existing.idempotency_key ? existing : null, error: null }),
        }),
      }),
    }),
  } as InviteDeliveryNotificationClient;

  return { client, inserted };
}

describe('invite delivery notification orchestration', () => {
  it('constructs a safe invite delivery payload with the token only in the outbound link', () => {
    const payload = createInviteDeliveryOutboxPayload({
      inviteId: ' invite-123 ',
      inviteeEmail: ' Invitee@Example.com ',
      inviterIdentityId: ' identity-inviter ',
      plaintextToken: TOKEN,
      communityId: 'community-123',
      expiresAt: '2026-07-14T12:00:00.000Z',
      appUrl: 'https://app.example.test/',
      now: NOW,
    });

    expect(payload).toEqual({
      notification_type: 'invite.delivery',
      recipient: 'invitee@example.com',
      payload: {
        inviteId: 'invite-123',
        inviteLink: `https://app.example.test/auth?invite=${TOKEN}`,
        communityId: 'community-123',
        expiresAt: '2026-07-14T12:00:00.000Z',
      },
      metadata: {
        inviteId: 'invite-123',
        communityId: 'community-123',
        inviterIdentityId: 'identity-inviter',
      },
      idempotency_key: 'invite-delivery:invite-123:created',
      status: 'pending',
      available_at: '2026-07-07T12:00:00.000Z',
    });
    expect(inviteDeliveryPayloadContainsPlaintextToken(payload, TOKEN)).toBe(false);
    expect(JSON.stringify(payload.metadata)).not.toContain(TOKEN);
  });

  it('enqueues one pending invite-delivery notification for an authorized invite creation', async () => {
    const { client, inserted } = createClient();

    await expect(
      enqueueInviteDeliveryNotification(client, {
        inviteId: 'invite-123',
        inviteeEmail: 'invitee@example.com',
        inviterIdentityId: 'identity-inviter',
        plaintextToken: TOKEN,
        appUrl: 'https://app.example.test',
        now: NOW,
      }),
    ).resolves.toEqual({
      enqueued: true,
      notificationId: 'notification-123',
      idempotencyKey: 'invite-delivery:invite-123:created',
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0].notification_type).toBe('invite.delivery');
  });

  it('suppresses duplicate invite sends with the created-delivery idempotency key', async () => {
    const { client, inserted } = createClient({ duplicate: true });

    await expect(
      enqueueInviteDeliveryNotification(client, {
        inviteId: 'invite-123',
        inviteeEmail: 'invitee@example.com',
        inviterIdentityId: 'identity-inviter',
        plaintextToken: TOKEN,
        appUrl: 'https://app.example.test',
        now: NOW,
      }),
    ).resolves.toEqual({
      enqueued: false,
      notificationId: 'notification-existing',
      idempotencyKey: 'invite-delivery:invite-123:created',
      reason: 'duplicate',
    });

    expect(inserted).toHaveLength(1);
    expect(buildInviteDeliveryIdempotencyKey('invite-123')).toBe('invite-delivery:invite-123:created');
  });
});
