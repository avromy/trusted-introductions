import { describe, expect, it } from 'vitest';

import {
  hashInviteToken,
  validateInviteTokenAction,
  type InvitationRow,
  type InviteValidationSupabaseClient,
} from '@/lib/invites';

const NOW = new Date('2026-07-07T12:00:00.000Z');
const TOKEN = 'plaintext-invite-token';

type SupabaseResult = { data: InvitationRow | null; error: { message: string } | null };

function invitation(overrides: Partial<InvitationRow> = {}): InvitationRow {
  return {
    id: 'invite-123',
    invitee_email: 'invitee@example.com',
    inviter_identity_id: 'identity-inviter',
    community_id: 'community-123',
    token_hash: hashInviteToken(TOKEN),
    status: 'pending',
    redemption_status: 'not_redeemed',
    expires_at: '2026-07-14T12:00:00.000Z',
    redeemed_at: null,
    redeemed_by_identity_id: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function mockInviteValidationClient(result: SupabaseResult) {
  const calls: { table?: string; select?: string; filters: { column: string; value: unknown }[] } = {
    filters: [],
  };

  const builder = {
    select(columns: string) {
      calls.select = columns;
      return builder;
    },
    insert() {
      throw new Error('validateInviteTokenAction must not write invitations.');
    },
    update() {
      throw new Error('validateInviteTokenAction must not write invitations.');
    },
    eq(column: string, value: unknown) {
      calls.filters.push({ column, value });
      return builder;
    },
    order() {
      throw new Error('validateInviteTokenAction must not list invitations.');
    },
    async maybeSingle() {
      return result;
    },
    single() {
      throw new Error('validateInviteTokenAction must not use single().');
    },
  };

  const client = {
    from(table: 'invitations') {
      calls.table = table;
      return builder;
    },
  } as unknown as InviteValidationSupabaseClient;

  return { calls, client };
}

describe('validateInviteTokenAction', () => {
  it('returns safe validation details for a valid pending invite', async () => {
    const row = invitation();
    const { calls, client } = mockInviteValidationClient({ data: row, error: null });

    const result = await validateInviteTokenAction(TOKEN, { supabase: client, now: NOW });

    expect(result).toEqual({
      valid: true,
      invite: {
        id: 'invite-123',
        inviteeEmail: 'invitee@example.com',
        communityId: 'community-123',
        expiresAt: '2026-07-14T12:00:00.000Z',
      },
    });
    expect(calls).toEqual({
      table: 'invitations',
      select: '*',
      filters: [{ column: 'token_hash', value: hashInviteToken(TOKEN) }],
    });
    expect(JSON.stringify(result)).not.toContain(TOKEN);
    expect(JSON.stringify(result)).not.toContain(row.token_hash);
    expect(JSON.stringify(result)).not.toContain('identity-inviter');
  });

  it('returns an invalid result for a missing or blank token without querying', async () => {
    const { calls, client } = mockInviteValidationClient({ data: invitation(), error: null });

    await expect(validateInviteTokenAction(undefined, { supabase: client, now: NOW })).resolves.toEqual({
      valid: false,
      reason: 'missing_token',
    });
    await expect(validateInviteTokenAction('   ', { supabase: client, now: NOW })).resolves.toEqual({
      valid: false,
      reason: 'missing_token',
    });
    expect(calls).toEqual({ filters: [] });
  });

  it('returns invalid results for expired, revoked, and redeemed invites', async () => {
    const cases: Array<[Partial<InvitationRow>, string]> = [
      [{ expires_at: '2026-07-07T11:59:59.000Z' }, 'expired'],
      [{ status: 'revoked', redemption_status: 'blocked' }, 'revoked'],
      [{ status: 'accepted', redemption_status: 'redeemed', redeemed_at: NOW.toISOString() }, 'redeemed'],
    ];

    for (const [overrides, reason] of cases) {
      const { client } = mockInviteValidationClient({ data: invitation(overrides), error: null });

      await expect(validateInviteTokenAction(TOKEN, { supabase: client, now: NOW })).resolves.toEqual({
        valid: false,
        reason,
      });
    }
  });

  it('returns an invalid result when the token hash has no matching invite', async () => {
    const { client } = mockInviteValidationClient({ data: null, error: null });

    await expect(validateInviteTokenAction(TOKEN, { supabase: client, now: NOW })).resolves.toEqual({
      valid: false,
      reason: 'not_found',
    });
  });
});
