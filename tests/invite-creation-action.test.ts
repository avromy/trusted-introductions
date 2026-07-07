import { describe, expect, it, vi } from 'vitest';

import { createInviteAction, type InviteCreationSupabaseClient } from '@/lib/invites/actions';
import { compareInviteTokenHash } from '@/lib/invites';

const NOW = new Date('2026-07-07T12:00:00.000Z');

type InsertedInvite = Parameters<ReturnType<InviteCreationSupabaseClient['from']>['insert']>[0];

function mockInviteCreationClient(options: {
  user?: Awaited<ReturnType<InviteCreationSupabaseClient['auth']['getUser']>>['data']['user'];
  inviteId?: string;
}) {
  const insertedInvites: InsertedInvite[] = [];
  const auditEvents: unknown[] = [];

  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options.user ?? null },
        error: null,
      })),
    },
    from: vi.fn((table: 'invitations' | 'audit_events') => {
      if (table === 'invitations') {
        return {
          insert: (payload: InsertedInvite) => {
            insertedInvites.push(payload);

            return {
              select: (columns: 'id') => ({
                single: async () => ({
                  data: { id: options.inviteId ?? 'invite-123' },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      return {
        insert: async (payload: unknown) => {
          auditEvents.push(payload);

          return { error: null };
        },
      };
    }),
  } as unknown as InviteCreationSupabaseClient;

  return { client, insertedInvites, auditEvents };
}

describe('createInviteAction', () => {
  it('requires a current authenticated identity', async () => {
    const { client } = mockInviteCreationClient({ user: null });

    await expect(
      createInviteAction({ inviteeEmail: 'invitee@example.com' }, { supabase: client, now: NOW }),
    ).rejects.toMatchObject({ code: 'AUTH_IDENTITY_REQUIRED' });
  });

  it('creates a hashed invite, writes audit event, and returns plaintext token only once', async () => {
    const { client, insertedInvites, auditEvents } = mockInviteCreationClient({
      user: {
        id: 'user-123',
        email: 'inviter@example.com',
        identities: [{ identity_id: 'identity-inviter', provider: 'email' }],
      },
      inviteId: 'invite-456',
    });

    const result = await createInviteAction(
      {
        inviteeEmail: ' Invitee@Example.com ',
        communityId: 'community-123',
      },
      { supabase: client, now: NOW },
    );

    expect(result).toMatchObject({
      inviteId: 'invite-456',
      expiresAt: '2026-07-14T12:00:00.000Z',
    });
    expect(result.plaintextToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    expect(insertedInvites).toHaveLength(1);
    expect(insertedInvites[0]).toMatchObject({
      invitee_email: 'invitee@example.com',
      inviter_identity_id: 'identity-inviter',
      community_id: 'community-123',
      status: 'pending',
      redemption_status: 'not_redeemed',
      expires_at: '2026-07-14T12:00:00.000Z',
    });
    expect(insertedInvites[0].token_hash).not.toBe(result.plaintextToken);
    expect(compareInviteTokenHash(result.plaintextToken, insertedInvites[0].token_hash)).toBe(true);

    expect(auditEvents).toEqual([
      {
        event_type: 'invite.created',
        actor_type: 'user',
        actor_id: 'identity-inviter',
        target_type: 'invite',
        target_id: 'invite-456',
        metadata: {
          communityId: 'community-123',
          inviteeEmail: 'invitee@example.com',
          expiresAt: '2026-07-14T12:00:00.000Z',
        },
        occurred_at: '2026-07-07T12:00:00.000Z',
      },
    ]);

    expect(JSON.stringify(insertedInvites)).not.toContain(result.plaintextToken);
    expect(JSON.stringify(auditEvents)).not.toContain(result.plaintextToken);
    expect(JSON.stringify(result).match(new RegExp(result.plaintextToken, 'g'))).toHaveLength(1);
  });
});
