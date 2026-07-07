import { describe, expect, it } from 'vitest';

import {
  ensureCurrentTrustedIdentityAction,
  TrustedIdentityActionError,
  type TrustedIdentityActionClient,
} from '@/lib/identity/actions';
import type { AuthUser } from '@/lib/auth/session';
import type { Database } from '@/types/supabase';

type TrustedIdentityRow = Database['public']['Tables']['trusted_identities']['Row'];

type FakeClientOptions = {
  user: AuthUser | null;
  identities?: TrustedIdentityRow[];
};

const NOW = '2026-07-07T00:00:00.000Z';

function identityRow(overrides: Partial<TrustedIdentityRow> = {}): TrustedIdentityRow {
  return {
    id: 'identity-1',
    user_id: 'user-1',
    primary_email: 'person@example.com',
    display_name: null,
    legal_name: null,
    phone: null,
    status: 'active',
    metadata: {},
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function createFakeClient({ user, identities = [] }: FakeClientOptions) {
  const state = {
    identities: [...identities],
    insertedIdentities: [] as Array<Pick<TrustedIdentityRow, 'user_id' | 'primary_email' | 'status' | 'metadata'>>,
    auditEvents: [] as unknown[],
  };

  const client = {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
    },
    from(table: 'trusted_identities' | 'audit_events') {
      if (table === 'audit_events') {
        return {
          insert: async (payload: unknown) => {
            state.auditEvents.push(payload);
            return { error: null };
          },
        };
      }

      return {
        select: () => {
          const filters: Partial<Record<'user_id' | 'primary_email', string>> = {};

          return {
            select: () => this,
            eq(column: 'user_id' | 'primary_email', value: string) {
              filters[column] = value;
              return this;
            },
            async maybeSingle() {
              const data =
                state.identities.find((identity) =>
                  Object.entries(filters).every(
                    ([column, value]) => identity[column as 'user_id' | 'primary_email'] === value,
                  ),
                ) ?? null;

              return { data, error: null };
            },
          };
        },
        insert: (payload: Pick<TrustedIdentityRow, 'user_id' | 'primary_email' | 'status' | 'metadata'>) => {
          state.insertedIdentities.push(payload);
          const row = identityRow({
            id: `identity-${state.identities.length + 1}`,
            ...payload,
          });
          state.identities.push(row);

          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
            }),
          };
        },
      };
    },
  } as unknown as TrustedIdentityActionClient;

  return { client, state };
}

describe('ensureCurrentTrustedIdentityAction', () => {
  it('creates a normalized trusted identity and audit event for the current user when missing', async () => {
    const { client, state } = createFakeClient({
      user: { id: 'user-1', email: ' Person@Example.COM ' },
    });

    const result = await ensureCurrentTrustedIdentityAction(client);

    expect(result.created).toBe(true);
    expect(result.identity).toMatchObject({
      user_id: 'user-1',
      primary_email: 'person@example.com',
      status: 'active',
    });
    expect(state.insertedIdentities).toEqual([
      {
        user_id: 'user-1',
        primary_email: 'person@example.com',
        status: 'active',
        metadata: {},
      },
    ]);
    expect(state.auditEvents).toHaveLength(1);
    expect(state.auditEvents[0]).toMatchObject({
      event_type: 'onboarding.started',
      actor_type: 'user',
      actor_id: 'user-1',
      target_type: 'trusted_identity',
      target_id: result.identity.id,
      metadata: {
        primaryEmail: 'person@example.com',
        action: 'trusted_identity.created',
      },
    });
  });

  it('loads the existing trusted identity without creating duplicates or audit events', async () => {
    const existingIdentity = identityRow({ id: 'identity-existing' });
    const { client, state } = createFakeClient({
      user: { id: 'user-1', email: 'person@example.com' },
      identities: [existingIdentity],
    });

    const result = await ensureCurrentTrustedIdentityAction(client);

    expect(result).toEqual({ identity: existingIdentity, created: false });
    expect(state.insertedIdentities).toEqual([]);
    expect(state.auditEvents).toEqual([]);
  });

  it('requires a current authenticated user email', async () => {
    const { client } = createFakeClient({ user: { id: 'user-1' } });

    await expect(ensureCurrentTrustedIdentityAction(client)).rejects.toBeInstanceOf(
      TrustedIdentityActionError,
    );
    await expect(ensureCurrentTrustedIdentityAction(client)).rejects.toThrow(
      'Current user must have an email to create a trusted identity.',
    );
  });
});
