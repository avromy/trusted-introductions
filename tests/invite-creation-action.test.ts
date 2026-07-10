import { describe, expect, it, vi } from 'vitest';

import {
  createInviteAction,
  redeemInviteAction,
  type InviteCreationSupabaseClient,
  type InviteRedemptionSupabaseClient,
} from '@/lib/invites/actions';
import { compareInviteTokenHash, hashInviteToken } from '@/lib/invites';
import type { Database } from '@/types/supabase';

const NOW = new Date('2026-07-07T12:00:00.000Z');

type InsertedInvite = Parameters<ReturnType<InviteCreationSupabaseClient['from']>['insert']>[0];
type InvitationRow = Database['public']['Tables']['invitations']['Row'];

const invitationRow: InvitationRow = {
  id: 'invite-123',
  invitee_email: 'invitee@example.com',
  inviter_identity_id: 'identity-inviter',
  community_id: 'community-123',
  token_hash: hashInviteToken('plaintext-invite-token'),
  status: 'pending',
  redemption_status: 'not_redeemed',
  expires_at: '2026-07-14T12:00:00.000Z',
  redeemed_at: null,
  redeemed_by_identity_id: null,
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
};

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

function mockInviteRedemptionClient(user: Awaited<ReturnType<InviteRedemptionSupabaseClient['auth']['getUser']>>['data']['user']) {
  const updates: unknown[] = [];
  const auditEvents: unknown[] = [];

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: invitationRow, error: null })),
    update: vi.fn((payload: unknown) => {
      updates.push(payload);
      return builder;
    }),
    single: vi.fn(async () => ({
      data: { ...invitationRow, ...(updates.at(-1) as Record<string, unknown> | undefined) },
      error: null,
    })),
    insert: vi.fn(() => builder),
    order: vi.fn(async () => ({ data: [invitationRow], error: null })),
  };

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: null })),
    },
    from: vi.fn((table: 'invitations' | 'audit_events') => {
      if (table === 'audit_events') {
        return {
          insert: async (payload: unknown) => {
            auditEvents.push(payload);
            return { error: null };
          },
        };
      }

      return builder;
    }),
  } as unknown as InviteRedemptionSupabaseClient;

  return { client, updates, auditEvents, builder };
}

describe('createInviteAction', () => {
  it('requires a current authenticated identity', async () => {
    const { client } = mockInviteCreationClient({ user: null });

    await expect(
      createInviteAction({ inviteeEmail: 'invitee@example.com' }, { supabase: client, now: NOW }),
    ).rejects.toMatchObject({ code: 'AUTH_IDENTITY_REQUIRED' });
  });

  it('does not write invites or audit events for unauthenticated creation attempts', async () => {
    const { client, insertedInvites, auditEvents } = mockInviteCreationClient({ user: null });

    await expect(
      createInviteAction({ inviteeEmail: 'invitee@example.com' }, { supabase: client, now: NOW }),
    ).rejects.toMatchObject({ code: 'AUTH_IDENTITY_REQUIRED' });

    expect(insertedInvites).toEqual([]);
    expect(auditEvents).toEqual([]);
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

describe('redeemInviteAction', () => {
  it('rejects unauthenticated redemption attempts without reading or mutating invites', async () => {
    const { client, updates, auditEvents, builder } = mockInviteRedemptionClient(null);

    await expect(
      redeemInviteAction('plaintext-invite-token', { supabase: client, now: NOW }),
    ).resolves.toEqual({ ok: false, reason: 'auth-required' });

    expect(builder.maybeSingle).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
    expect(auditEvents).toEqual([]);
  });
});
