import { describe, expect, it, vi } from 'vitest';

import {
  getCurrentRolesForIdentity,
  replaceRolesForIdentity,
  saveContributionModeForIdentity,
  type OnboardingRoleRepositoryClient,
} from '@/lib/onboarding/role-repository';
import type { Database } from '@/types/supabase';

type TrustedIdentityRow = Database['public']['Tables']['trusted_identities']['Row'];
type UserRoleRow = Database['public']['Tables']['user_roles']['Row'];

const IDENTITY_ID = 'identity-123';

const identity: TrustedIdentityRow = {
  id: IDENTITY_ID,
  user_id: 'user-123',
  primary_email: 'person@example.com',
  display_name: 'Person Example',
  legal_name: null,
  phone: null,
  metadata: { existing: 'value' },
  status: 'active',
  created_at: '2026-07-07T00:00:00.000Z',
  updated_at: '2026-07-07T00:00:00.000Z',
};

const memberRole: UserRoleRow = {
  id: 'role-123',
  identity_id: IDENTITY_ID,
  community_id: 'community-123',
  role: 'member',
  granted_by_identity_id: 'identity-granter',
  created_at: '2026-07-07T00:00:00.000Z',
  updated_at: '2026-07-07T00:00:00.000Z',
};

function createRepositoryMock(
  options: {
    roles?: UserRoleRow[];
    identityRow?: TrustedIdentityRow | null;
    roleSelectError?: Error | null;
    roleDeleteError?: Error | null;
    roleInsertError?: Error | null;
    identitySelectError?: Error | null;
    identityUpdateError?: Error | null;
    identityUpdateData?: TrustedIdentityRow | null;
  } = {},
) {
  const writes = {
    roleDeletes: [] as unknown[],
    roleInserts: [] as unknown[],
    identityUpdates: [] as unknown[],
  };

  const selectRoles = vi.fn(() => ({
    eq: vi.fn(async (column: keyof UserRoleRow, value: string) => ({
      data: (options.roles ?? []).filter((role) => role[column] === value),
      error: options.roleSelectError ?? null,
    })),
  }));
  const deleteRoles = vi.fn(() => ({
    eq: vi.fn(async (column: keyof UserRoleRow, value: string) => {
      writes.roleDeletes.push({ column, value });
      return { error: options.roleDeleteError ?? null };
    }),
  }));
  const insertRoles = vi.fn((payload: unknown[]) => {
    writes.roleInserts.push(payload);
    return {
      select: vi.fn(async () => ({ data: payload, error: options.roleInsertError ?? null })),
    };
  });

  const selectIdentity = vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data: options.identityRow === undefined ? identity : options.identityRow,
        error: options.identitySelectError ?? null,
      })),
    })),
  }));
  const updateIdentity = vi.fn((payload: unknown) => {
    writes.identityUpdates.push(payload);
    return {
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({
            data:
              options.identityUpdateData === undefined
                ? { ...identity, ...(payload as Partial<TrustedIdentityRow>) }
                : options.identityUpdateData,
            error: options.identityUpdateError ?? null,
          })),
        })),
      })),
    };
  });

  const from = vi.fn((table: 'user_roles' | 'trusted_identities') => {
    if (table === 'user_roles') {
      return { select: selectRoles, delete: deleteRoles, insert: insertRoles };
    }

    return { select: selectIdentity, update: updateIdentity };
  });

  return {
    supabase: { from } as unknown as OnboardingRoleRepositoryClient,
    calls: { deleteRoles, from, insertRoles, selectIdentity, selectRoles, updateIdentity },
    writes,
  };
}

describe('onboarding role repository helpers', () => {
  it('gets the current roles for an identity', async () => {
    const { supabase, calls } = createRepositoryMock({ roles: [memberRole] });

    await expect(getCurrentRolesForIdentity(supabase, IDENTITY_ID)).resolves.toEqual([memberRole]);
    expect(calls.from).toHaveBeenCalledWith('user_roles');
    expect(calls.selectRoles).toHaveBeenCalledWith(
      'id, identity_id, community_id, role, granted_by_identity_id, created_at, updated_at',
    );
  });

  it('returns an empty role list when no roles exist', async () => {
    const { supabase } = createRepositoryMock({ roles: [] });

    await expect(getCurrentRolesForIdentity(supabase, IDENTITY_ID)).resolves.toEqual([]);
  });

  it('replaces roles by deleting existing rows before inserting new rows', async () => {
    const { supabase, writes } = createRepositoryMock();

    await replaceRolesForIdentity(supabase, IDENTITY_ID, [
      { role: 'member', communityId: 'community-123', grantedByIdentityId: 'identity-granter' },
      { role: 'steward' },
    ]);

    expect(writes.roleDeletes).toEqual([{ column: 'identity_id', value: IDENTITY_ID }]);
    expect(writes.roleInserts).toEqual([
      [
        {
          identity_id: IDENTITY_ID,
          role: 'member',
          community_id: 'community-123',
          granted_by_identity_id: 'identity-granter',
        },
        {
          identity_id: IDENTITY_ID,
          role: 'steward',
          community_id: null,
          granted_by_identity_id: null,
        },
      ],
    ]);
  });

  it('only deletes roles when replacement roles are empty', async () => {
    const { supabase, calls, writes } = createRepositoryMock();

    await expect(replaceRolesForIdentity(supabase, IDENTITY_ID, [])).resolves.toEqual([]);
    expect(writes.roleDeletes).toEqual([{ column: 'identity_id', value: IDENTITY_ID }]);
    expect(calls.insertRoles).not.toHaveBeenCalled();
  });

  it('saves contribution mode in trusted identity metadata without dropping existing metadata', async () => {
    const { supabase, writes } = createRepositoryMock();

    await expect(
      saveContributionModeForIdentity(supabase, IDENTITY_ID, ' helper '),
    ).resolves.toMatchObject({
      metadata: { existing: 'value', contributionMode: 'helper', contribution_mode: 'helper' },
    });
    expect(writes.identityUpdates).toEqual([
      { metadata: { existing: 'value', contributionMode: 'helper', contribution_mode: 'helper' } },
    ]);
  });

  it('clears blank contribution mode values', async () => {
    const { supabase, writes } = createRepositoryMock();

    await saveContributionModeForIdentity(supabase, IDENTITY_ID, '   ');

    expect(writes.identityUpdates).toEqual([
      { metadata: { existing: 'value', contributionMode: null, contribution_mode: null } },
    ]);
  });

  it('throws when saving contribution mode for a missing identity', async () => {
    const { supabase } = createRepositoryMock({ identityRow: null });

    await expect(saveContributionModeForIdentity(supabase, IDENTITY_ID, 'helper')).rejects.toThrow(
      'Trusted identity was not found.',
    );
  });
});
