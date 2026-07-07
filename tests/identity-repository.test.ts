import { describe, expect, it } from 'vitest';

import {
  createTrustedIdentity,
  getTrustedIdentityByEmail,
  getTrustedIdentityByUserId,
  normalizeIdentityEmail,
  updateTrustedIdentityRoles,
  type TrustedIdentityRepositoryClient,
} from '@/lib/identity';
import type { Database } from '@/types/supabase';

type TrustedIdentityRow = Database['public']['Tables']['trusted_identities']['Row'];
type UserRoleRow = Database['public']['Tables']['user_roles']['Row'];

const identity: TrustedIdentityRow = {
  id: 'identity-123',
  user_id: 'user-123',
  primary_email: 'person@example.com',
  display_name: 'Person Example',
  legal_name: null,
  phone: null,
  metadata: {},
  status: 'active',
  created_at: '2026-07-07T00:00:00.000Z',
  updated_at: '2026-07-07T00:00:00.000Z',
};

const stewardRole: UserRoleRow = {
  id: 'role-123',
  identity_id: 'identity-123',
  community_id: null,
  role: 'steward',
  granted_by_identity_id: 'identity-granter',
  created_at: '2026-07-07T00:00:00.000Z',
  updated_at: '2026-07-07T00:00:00.000Z',
};

function repositoryClient(options: {
  identities?: TrustedIdentityRow[];
  roles?: UserRoleRow[];
  errors?: Partial<Record<'identity' | 'roles' | 'insertIdentity' | 'deleteRoles' | 'insertRoles', Error>>;
  writes?: { identityInserts: unknown[]; roleInserts: unknown[]; roleDeletes: unknown[] };
} = {}): TrustedIdentityRepositoryClient {
  const identities = options.identities ?? [];
  const roles = options.roles ?? [];
  const writes = options.writes ?? { identityInserts: [], roleInserts: [], roleDeletes: [] };

  return {
    from(table) {
      if (table === 'trusted_identities') {
        return {
          select() {
            return this;
          },
          eq(column: keyof TrustedIdentityRow, value: string) {
            const row = identities.find((candidate) => candidate[column] === value) ?? null;
            return {
              maybeSingle: async () => ({ data: row, error: options.errors?.identity ?? null }),
            };
          },
          insert(payload: unknown) {
            writes.identityInserts.push(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: { ...identity, ...(payload as Partial<TrustedIdentityRow>) },
                  error: options.errors?.insertIdentity ?? null,
                }),
              }),
            };
          },
        };
      }

      return {
        select() {
          return this;
        },
        eq(column: keyof UserRoleRow, value: string) {
          return Promise.resolve({
            data: roles.filter((role) => role[column] === value),
            error: options.errors?.roles ?? null,
          });
        },
        delete() {
          return {
            eq: async (column: keyof UserRoleRow, value: string) => {
              writes.roleDeletes.push({ column, value });
              return { error: options.errors?.deleteRoles ?? null };
            },
          };
        },
        insert(payload: unknown[]) {
          writes.roleInserts.push(payload);
          return Promise.resolve({ data: payload, error: options.errors?.insertRoles ?? null });
        },
      };
    },
  };
}

describe('trusted identity repository helpers', () => {
  it('normalizes identity email casing and surrounding whitespace', () => {
    expect(normalizeIdentityEmail('  Person@Example.COM  ')).toBe('person@example.com');
  });

  it('fetches trusted identity by user id with roles', async () => {
    const result = await getTrustedIdentityByUserId(
      repositoryClient({ identities: [identity], roles: [stewardRole] }),
      'user-123',
    );

    expect(result).toEqual({ ...identity, roles: [stewardRole] });
  });

  it('fetches trusted identity by normalized email', async () => {
    const result = await getTrustedIdentityByEmail(
      repositoryClient({ identities: [identity], roles: [stewardRole] }),
      ' PERSON@EXAMPLE.COM ',
    );

    expect(result?.primary_email).toBe('person@example.com');
    expect(result?.roles).toEqual([stewardRole]);
  });

  it('returns null when no trusted identity matches', async () => {
    await expect(getTrustedIdentityByUserId(repositoryClient(), 'missing-user')).resolves.toBeNull();
  });

  it('creates trusted identity with normalized email and default pending status', async () => {
    const writes = { identityInserts: [], roleInserts: [], roleDeletes: [] };
    const result = await createTrustedIdentity(repositoryClient({ writes }), {
      primaryEmail: ' NewPerson@Example.COM ',
      display_name: 'New Person',
      user_id: 'user-new',
    });

    expect(writes.identityInserts).toEqual([
      {
        display_name: 'New Person',
        legal_name: null,
        metadata: {},
        phone: null,
        primary_email: 'newperson@example.com',
        status: 'pending',
        user_id: 'user-new',
      },
    ]);
    expect(result.roles).toEqual([]);
    expect(result.primary_email).toBe('newperson@example.com');
  });

  it('replaces trusted identity roles', async () => {
    const writes = { identityInserts: [], roleInserts: [], roleDeletes: [] };
    await updateTrustedIdentityRoles(repositoryClient({ writes }), 'identity-123', [
      { role: 'member', communityId: 'community-123', grantedByIdentityId: 'identity-granter' },
      { role: 'steward' },
    ]);

    expect(writes.roleDeletes).toEqual([{ column: 'identity_id', value: 'identity-123' }]);
    expect(writes.roleInserts).toEqual([
      [
        {
          identity_id: 'identity-123',
          role: 'member',
          community_id: 'community-123',
          granted_by_identity_id: 'identity-granter',
        },
        {
          identity_id: 'identity-123',
          role: 'steward',
          community_id: null,
          granted_by_identity_id: null,
        },
      ],
    ]);
  });
});
