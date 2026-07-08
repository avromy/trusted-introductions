import { describe, expect, it } from 'vitest';

import {
  canCreateInvite,
  canListInvitesForCommunity,
  canRevokeInvite,
} from '@/lib/invites/authorization';
import type {
  InviteAdministrationIdentity,
  InviteAdministrationInvite,
} from '@/lib/invites/authorization';

const baseIdentity = {
  id: 'identity-123',
  status: 'active' as const,
  roles: [],
};

function identity(
  overrides: Partial<InviteAdministrationIdentity> = {},
): InviteAdministrationIdentity {
  return {
    ...baseIdentity,
    ...overrides,
    roles: overrides.roles ?? baseIdentity.roles,
  };
}

function invite(overrides: Partial<InviteAdministrationInvite> = {}): InviteAdministrationInvite {
  return {
    community_id: 'community-123',
    inviter_identity_id: 'identity-inviter',
    ...overrides,
  };
}

describe('invite administration authorization helpers', () => {
  it('allows active stewards and admins to create invites for their community', () => {
    expect(
      canCreateInvite(
        identity({ roles: [{ role: 'steward', community_id: 'community-123' }] }),
        'community-123',
      ),
    ).toBe(true);
    expect(
      canCreateInvite(
        identity({ roles: [{ role: 'admin', community_id: 'community-123' }] }),
        'community-123',
      ),
    ).toBe(true);
  });

  it('allows global stewards and admins to create and list invites for any community', () => {
    const globalSteward = identity({ roles: [{ role: 'steward', community_id: null }] });

    expect(canCreateInvite(globalSteward, 'community-456')).toBe(true);
    expect(canListInvitesForCommunity(globalSteward, 'community-456')).toBe(true);
  });

  it('denies invite administration to inactive identities, missing identities, members, and other communities', () => {
    expect(canCreateInvite(null, 'community-123')).toBe(false);
    expect(
      canCreateInvite(
        identity({ status: 'pending', roles: [{ role: 'steward', community_id: null }] }),
      ),
    ).toBe(false);
    expect(
      canCreateInvite(
        identity({ roles: [{ role: 'member', community_id: 'community-123' }] }),
        'community-123',
      ),
    ).toBe(false);
    expect(
      canListInvitesForCommunity(
        identity({ roles: [{ role: 'steward', community_id: 'community-456' }] }),
        'community-123',
      ),
    ).toBe(false);
  });

  it('allows an active inviter to revoke their own invite', () => {
    expect(canRevokeInvite(identity({ id: 'identity-inviter' }), invite())).toBe(true);
  });

  it('allows active stewards and admins to revoke invites in their community', () => {
    expect(
      canRevokeInvite(
        identity({ roles: [{ role: 'steward', community_id: 'community-123' }] }),
        invite(),
      ),
    ).toBe(true);
    expect(
      canRevokeInvite(identity({ roles: [{ role: 'admin', community_id: null }] }), invite()),
    ).toBe(true);
  });

  it('denies revocation for missing invites, inactive inviters, members, and administrators from other communities', () => {
    expect(canRevokeInvite(identity({ id: 'identity-inviter' }), null)).toBe(false);
    expect(
      canRevokeInvite(identity({ id: 'identity-inviter', status: 'suspended' }), invite()),
    ).toBe(false);
    expect(
      canRevokeInvite(
        identity({ roles: [{ role: 'member', community_id: 'community-123' }] }),
        invite(),
      ),
    ).toBe(false);
    expect(
      canRevokeInvite(
        identity({ roles: [{ role: 'steward', community_id: 'community-456' }] }),
        invite(),
      ),
    ).toBe(false);
  });
});
