import { describe, expect, it } from 'vitest';

import {
  StewardAuthorizationError,
  hasStewardOrAdminRole,
  requireCurrentTrustedIdentity,
  requireStewardOrAdmin,
  toSafeAuthFailureResult,
  type SafeAuthFailureResult,
} from '@/lib/auth/steward';
import type { AuthUser } from '@/lib/auth/session';
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

function role(roleName: UserRoleRow['role'], communityId: string | null = null): UserRoleRow {
  return {
    id: `${roleName}-role`,
    identity_id: identity.id,
    community_id: communityId,
    role: roleName,
    granted_by_identity_id: null,
    created_at: '2026-07-07T00:00:00.000Z',
    updated_at: '2026-07-07T00:00:00.000Z',
  };
}

function client(
  options: {
    user?: AuthUser | null;
    authError?: string;
    identity?: TrustedIdentityRow | null;
    roles?: UserRoleRow[];
    identityError?: Error | null;
    rolesError?: Error | null;
  } = {},
) {
  const user = options.user === undefined ? { id: 'user-123' } : options.user;
  const trustedIdentity = options.identity === undefined ? identity : options.identity;
  const roles = options.roles ?? [];

  return {
    auth: {
      getUser: async () => ({
        data: { user },
        error: options.authError ? { message: options.authError } : null,
      }),
    },
    from(table: 'trusted_identities' | 'user_roles') {
      if (table === 'trusted_identities') {
        return {
          select() {
            return this;
          },
          eq(column: keyof TrustedIdentityRow, value: string) {
            const row =
              trustedIdentity && trustedIdentity[column] === value ? trustedIdentity : null;
            return {
              maybeSingle: async () => ({ data: row, error: options.identityError ?? null }),
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
            data: roles.filter((candidate) => candidate[column] === value),
            error: options.rolesError ?? null,
          });
        },
      };
    },
  };
}

describe('steward authorization helpers', () => {
  it('requires the current signed-in user to have an active trusted identity', async () => {
    const currentIdentity = await requireCurrentTrustedIdentity(
      client({ roles: [role('member')] }),
    );

    expect(currentIdentity).toEqual({ ...identity, roles: [role('member')] });
  });

  it('rejects a signed-in user without a trusted identity', async () => {
    await expect(requireCurrentTrustedIdentity(client({ identity: null }))).rejects.toMatchObject({
      code: 'TRUSTED_IDENTITY_REQUIRED',
      message: 'A trusted identity is required.',
    });
  });

  it('rejects inactive trusted identities', async () => {
    await expect(
      requireCurrentTrustedIdentity(client({ identity: { ...identity, status: 'suspended' } })),
    ).rejects.toMatchObject({
      code: 'TRUSTED_IDENTITY_INACTIVE',
      message: 'An active trusted identity is required.',
    });
  });

  it('checks steward and admin roles with optional community scoping', () => {
    expect(hasStewardOrAdminRole({ roles: [role('member')] })).toBe(false);
    expect(hasStewardOrAdminRole({ roles: [role('steward')] })).toBe(true);
    expect(hasStewardOrAdminRole({ roles: [role('admin')] })).toBe(true);
    expect(hasStewardOrAdminRole({ roles: [role('steward', 'community-1')] }, 'community-1')).toBe(
      true,
    );
    expect(hasStewardOrAdminRole({ roles: [role('steward', 'community-1')] }, 'community-2')).toBe(
      false,
    );
  });

  it('requires a steward or admin role for steward-only operations', async () => {
    await expect(requireStewardOrAdmin(client({ roles: [role('admin')] }))).resolves.toEqual({
      ...identity,
      roles: [role('admin')],
    });

    await expect(requireStewardOrAdmin(client({ roles: [role('member')] }))).rejects.toMatchObject({
      code: 'STEWARD_REQUIRED',
      message: 'A steward or admin role is required.',
    });
  });

  it('returns safe auth failure results without leaking internal details', () => {
    const authRequired = toSafeAuthFailureResult(
      new StewardAuthorizationError('raw lookup failure', 'AUTH_USER_LOOKUP_FAILED'),
    );
    const forbidden = toSafeAuthFailureResult(
      new StewardAuthorizationError('specific missing role', 'STEWARD_REQUIRED'),
    );
    const unknown = toSafeAuthFailureResult(new Error('database details'));

    expect(authRequired).toEqual({
      ok: false,
      error: 'auth_required',
      message: 'Authentication is required.',
    } satisfies SafeAuthFailureResult);
    expect(forbidden).toEqual({
      ok: false,
      error: 'forbidden',
      message: 'You are not authorized to perform this action.',
    });
    expect(unknown).toEqual(forbidden);
  });
});
