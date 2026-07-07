import { describe, expect, it } from 'vitest';

import {
  getInviteByTokenHash,
  hashInviteToken,
  insertInvite,
  listInvitesByInviterIdentity,
  updateInviteRedeemed,
  updateInviteRevoked,
  type InvitationRow,
  type InviteRepositoryClient,
} from '@/lib/invites';

const NOW = new Date('2026-07-07T00:00:00.000Z');
const TOKEN = 'plaintext-invite-token';

type SupabaseResult = { data: unknown; error: { message: string } | null };
type SupabaseOperation = {
  method: 'insert' | 'update';
  payload: unknown;
};
type SupabaseFilter = {
  column: string;
  value: unknown;
};
type SupabaseOrder = {
  column: string;
  options: unknown;
};

function invitation(overrides: Partial<InvitationRow> = {}): InvitationRow {
  return {
    id: 'invite-123',
    invitee_email: 'invitee@example.com',
    inviter_identity_id: 'identity-inviter',
    community_id: 'community-123',
    token_hash: hashInviteToken(TOKEN),
    status: 'pending',
    redemption_status: 'not_redeemed',
    expires_at: '2026-07-14T00:00:00.000Z',
    redeemed_at: null,
    redeemed_by_identity_id: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function createSupabaseMock(result: SupabaseResult) {
  const calls: {
    table?: string;
    select?: string;
    operation?: SupabaseOperation;
    filters: SupabaseFilter[];
    orders: SupabaseOrder[];
    terminal?: 'single' | 'maybeSingle' | 'order';
  } = {
    filters: [],
    orders: [],
  };

  const builder = {
    select(columns: string) {
      calls.select = columns;
      return builder;
    },
    insert(payload: unknown) {
      calls.operation = { method: 'insert', payload };
      return builder;
    },
    update(payload: unknown) {
      calls.operation = { method: 'update', payload };
      return builder;
    },
    eq(column: string, value: unknown) {
      calls.filters.push({ column, value });
      return builder;
    },
    order(column: string, options: unknown) {
      calls.orders.push({ column, options });
      calls.terminal = 'order';
      return Promise.resolve(result);
    },
    maybeSingle() {
      calls.terminal = 'maybeSingle';
      return Promise.resolve(result);
    },
    single() {
      calls.terminal = 'single';
      return Promise.resolve(result);
    },
  };

  const client = {
    from(table: string) {
      calls.table = table;
      return builder;
    },
  } as unknown as InviteRepositoryClient;

  return { calls, client };
}

describe('invite repository helpers', () => {
  it('gets an invite by token hash without exposing plaintext tokens', async () => {
    const tokenHash = hashInviteToken(TOKEN);
    const row = invitation({ token_hash: tokenHash });
    const { calls, client } = createSupabaseMock({ data: row, error: null });

    await expect(getInviteByTokenHash(tokenHash, client)).resolves.toEqual(row);

    expect(calls).toMatchObject({
      table: 'invitations',
      select: '*',
      filters: [{ column: 'token_hash', value: tokenHash }],
      terminal: 'maybeSingle',
    });
    expect(JSON.stringify(calls)).not.toContain(TOKEN);
  });

  it('inserts an invite using lifecycle payload defaults', async () => {
    const row = invitation();
    const { calls, client } = createSupabaseMock({ data: row, error: null });

    const result = await insertInvite(
      {
        inviteeEmail: 'invitee@example.com',
        inviterIdentityId: 'identity-inviter',
        communityId: 'community-123',
        token: TOKEN,
        now: NOW,
      },
      client,
    );

    expect(result).toEqual({ invite: row, plaintextToken: TOKEN });
    expect(calls.operation).toEqual({
      method: 'insert',
      payload: {
        invitee_email: 'invitee@example.com',
        inviter_identity_id: 'identity-inviter',
        community_id: 'community-123',
        token_hash: hashInviteToken(TOKEN),
        status: 'pending',
        redemption_status: 'not_redeemed',
        expires_at: '2026-07-14T00:00:00.000Z',
      },
    });
    expect(calls.terminal).toBe('single');
  });

  it('updates an invite as redeemed through the lifecycle payload', async () => {
    const row = invitation({
      status: 'accepted',
      redemption_status: 'redeemed',
      redeemed_at: NOW.toISOString(),
      redeemed_by_identity_id: 'identity-redeemer',
    });
    const { calls, client } = createSupabaseMock({ data: row, error: null });

    await expect(
      updateInviteRedeemed(
        { inviteId: 'invite-123', redeemedByIdentityId: 'identity-redeemer', redeemedAt: NOW },
        client,
      ),
    ).resolves.toEqual(row);

    expect(calls.operation).toEqual({
      method: 'update',
      payload: {
        status: 'accepted',
        redemption_status: 'redeemed',
        redeemed_by_identity_id: 'identity-redeemer',
        redeemed_at: NOW.toISOString(),
      },
    });
    expect(calls.filters).toEqual([{ column: 'id', value: 'invite-123' }]);
  });

  it('updates an invite as revoked through the lifecycle payload', async () => {
    const row = invitation({ status: 'revoked', redemption_status: 'blocked' });
    const { calls, client } = createSupabaseMock({ data: row, error: null });

    await expect(
      updateInviteRevoked({ inviteId: 'invite-123', revokedAt: NOW }, client),
    ).resolves.toEqual(row);

    expect(calls.operation).toEqual({
      method: 'update',
      payload: {
        status: 'revoked',
        redemption_status: 'blocked',
        updated_at: NOW.toISOString(),
      },
    });
    expect(calls.filters).toEqual([{ column: 'id', value: 'invite-123' }]);
  });

  it('lists invites for an inviter identity newest first', async () => {
    const rows = [invitation()];
    const { calls, client } = createSupabaseMock({ data: rows, error: null });

    await expect(listInvitesByInviterIdentity('identity-inviter', client)).resolves.toEqual(rows);

    expect(calls).toMatchObject({
      table: 'invitations',
      select: '*',
      filters: [{ column: 'inviter_identity_id', value: 'identity-inviter' }],
      orders: [{ column: 'created_at', options: { ascending: false } }],
      terminal: 'order',
    });
  });

  it('throws Supabase errors with repository context', async () => {
    const { client } = createSupabaseMock({
      data: null,
      error: { message: 'database unavailable' },
    });

    await expect(listInvitesByInviterIdentity('identity-inviter', client)).rejects.toThrow(
      'Failed to list invites by inviter identity: database unavailable',
    );
  });
});
