import type { TrustedIdentityWithRoles } from '@/lib/identity';
import type { InvitationRow } from '@/lib/invites/repository';
import type { Database } from '@/types/supabase';

type UserRoleRow = Database['public']['Tables']['user_roles']['Row'];
type UserRoleName = Database['public']['Enums']['user_role_name'];

export type InviteAdministrationIdentity = Pick<TrustedIdentityWithRoles, 'id' | 'status'> & {
  roles?: Pick<UserRoleRow, 'role' | 'community_id'>[] | null;
};

export type InviteAdministrationInvite = Pick<
  InvitationRow,
  'community_id' | 'inviter_identity_id'
>;

const INVITE_ADMINISTRATION_ROLES = new Set<UserRoleName>(['admin', 'steward']);

function isActiveIdentity(
  identity: InviteAdministrationIdentity | null | undefined,
): identity is InviteAdministrationIdentity {
  return identity?.status === 'active';
}

function hasInviteAdministrationRole(
  identity: InviteAdministrationIdentity | null | undefined,
  communityId?: string | null,
): boolean {
  if (!isActiveIdentity(identity)) {
    return false;
  }

  return (identity.roles ?? []).some((role) => {
    if (!INVITE_ADMINISTRATION_ROLES.has(role.role)) {
      return false;
    }

    return role.community_id === null || role.community_id === (communityId ?? null);
  });
}

export function canCreateInvite(
  identity: InviteAdministrationIdentity | null | undefined,
  communityId?: string | null,
): boolean {
  return hasInviteAdministrationRole(identity, communityId);
}

export function canListInvitesForCommunity(
  identity: InviteAdministrationIdentity | null | undefined,
  communityId?: string | null,
): boolean {
  return hasInviteAdministrationRole(identity, communityId);
}

export function canRevokeInvite(
  identity: InviteAdministrationIdentity | null | undefined,
  invite: InviteAdministrationInvite | null | undefined,
): boolean {
  if (!isActiveIdentity(identity) || !invite) {
    return false;
  }

  return (
    invite.inviter_identity_id === identity.id ||
    hasInviteAdministrationRole(identity, invite.community_id)
  );
}
