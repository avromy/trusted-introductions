import { describe, expect, it, vi } from 'vitest';

import { revokeInviteAction, type InviteRevocationSupabaseClient } from '@/lib/invites/actions';
import type { Database } from '@/types/supabase';

const NOW = new Date('2026-07-07T12:00:00.000Z');

type InvitationRow = Database['public']['Tables']['invitations']['Row'];
type InvitationUpdate = Partial<InvitationRow>;

function invitation(overrides: Partial<InvitationRow> = {}): InvitationRow {
  return {
    id: 'invite-123',
    invitee_email: 'invitee@example.com',
    inviter_identity_id: 'identity-inviter',
    community_id: 'community-123',
    token_hash: 'hashed-token',
    status: 'pending',
    redemption_status: 'not_redeemed',
    expires_at: '2026-07-14T12:00:00.000Z',
    redeemed_at: null,
    redeemed_by_identity_id: null,
    created_at: '2026-07-07T11:00:00.000Z',
    updated_at: '2026-07-07T11:00:00.000Z',
    ...overrides,
  };
}

function mockInviteRevocationClient(options: {
  user?: Awaited<ReturnType<InviteRevocationSupabaseClient['auth']['getUser']>>['data']['user'];
  invite?: InvitationRow | null;
  updateError?: { message?: string } | null;
} = {}) {
  const updates: InvitationUpdate[] = [];
  const filters: Array<{ column: string; value: unknown }> = [];
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
          update: (payload: InvitationUpdate) => {
            updates.push(payload);

            return {
              eq: (column: string, value: unknown) => {
                filters.push({ column, value });

                return {
                  select: (columns: '*') => ({
                    single: async () => ({
                      data: options.invite ?? null,
                      error:
                        options.updateError ??
                        (options.invite === null ? { message: 'JSON object requested, multiple (or no) rows returned' } : null),
                    }),
                  }),
                };
              },
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
  } as unknown as InviteRevocationSupabaseClient;

  return { client, updates, filters, auditEvents };
}

const AUTHENTICATED_USER = {
  id: 'user-123',
  email: 'inviter@example.com',
  identities: [{ identity_id: 'identity-revoker', provider: 'email' }],
};

describe('revokeInviteAction', () => {
  it('returns a safe validation error for a blank invite id', async () => {
    const { client, updates, auditEvents } = mockInviteRevocationClient({ user: AUTHENTICATED_USER });

    await expect(revokeInviteAction('   ', { supabase: client, now: NOW })).resolves.toEqual({
      ok: false,
      error: 'validation_failed',
      message: 'Invite id is required.',
    });
    expect(updates).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it('returns a safe auth-required result when no trusted identity is authenticated', async () => {
    const { client, updates, auditEvents } = mockInviteRevocationClient({ user: null });

    await expect(revokeInviteAction('invite-123', { supabase: client, now: NOW })).resolves.toEqual({
      ok: false,
      error: 'auth_required',
      message: 'A signed-in trusted identity is required to revoke an invite.',
    });
    expect(updates).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it('marks an existing invite revoked, writes audit, and returns no token data', async () => {
    const revokedInvite = invitation({
      status: 'revoked',
      redemption_status: 'blocked',
      updated_at: NOW.toISOString(),
    });
    const { client, updates, filters, auditEvents } = mockInviteRevocationClient({
      user: AUTHENTICATED_USER,
      invite: revokedInvite,
    });

    const result = await revokeInviteAction(' invite-123 ', { supabase: client, now: NOW });

    expect(result).toEqual({
      ok: true,
      invite: {
        id: 'invite-123',
        status: 'revoked',
        redemptionStatus: 'blocked',
        revokedAt: NOW.toISOString(),
      },
    });
    expect(updates).toEqual([
      {
        status: 'revoked',
        redemption_status: 'blocked',
        updated_at: NOW.toISOString(),
      },
    ]);
    expect(filters).toEqual([{ column: 'id', value: 'invite-123' }]);
    expect(auditEvents).toEqual([
      {
        event_type: 'invite.revoked',
        actor_type: 'user',
        actor_id: 'identity-revoker',
        target_type: 'invite',
        target_id: 'invite-123',
        metadata: {
          communityId: 'community-123',
          revokedAt: NOW.toISOString(),
        },
        occurred_at: NOW.toISOString(),
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('hashed-token');
    expect(JSON.stringify(result)).not.toContain('token_hash');
    expect(JSON.stringify(auditEvents)).not.toContain('hashed-token');
  });

  it('returns a safe not-found result when the invite is missing', async () => {
    const { client, auditEvents } = mockInviteRevocationClient({
      user: AUTHENTICATED_USER,
      invite: null,
    });

    await expect(revokeInviteAction('missing-invite', { supabase: client, now: NOW })).resolves.toEqual({
      ok: false,
      error: 'not_found',
      message: 'Invite not found.',
    });
    expect(auditEvents).toEqual([]);
  });
});
