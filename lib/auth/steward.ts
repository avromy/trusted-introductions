import { getCurrentUser, type SupabaseAuthClient } from '@/lib/auth/session';
import {
  getTrustedIdentityByUserId,
  type TrustedIdentityRepositoryClient,
  type TrustedIdentityWithRoles,
} from '@/lib/identity';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

type UserRoleName = Database['public']['Enums']['user_role_name'];

type StewardAuthorizationClient = SupabaseAuthClient & TrustedIdentityRepositoryClient;

export type StewardAuthorizationErrorCode =
  | 'AUTH_USER_LOOKUP_FAILED'
  | 'AUTH_REQUIRED'
  | 'AUTH_IDENTITY_REQUIRED'
  | 'TRUSTED_IDENTITY_REQUIRED'
  | 'TRUSTED_IDENTITY_INACTIVE'
  | 'STEWARD_REQUIRED';

export type SafeAuthFailureReason = 'auth_required' | 'forbidden';

export type SafeAuthFailureResult = {
  ok: false;
  error: SafeAuthFailureReason;
  message: string;
};

export class StewardAuthorizationError extends Error {
  constructor(
    message: string,
    public readonly code: StewardAuthorizationErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StewardAuthorizationError';
  }
}

function getServerClient(): StewardAuthorizationClient {
  return createClient() as unknown as StewardAuthorizationClient;
}

function isActiveTrustedIdentity(identity: TrustedIdentityWithRoles): boolean {
  return identity.status === 'active';
}

function roleMatchesCommunity(
  role: TrustedIdentityWithRoles['roles'][number],
  communityId?: string | null,
): boolean {
  return (
    communityId === undefined || role.community_id === null || role.community_id === communityId
  );
}

export function hasStewardOrAdminRole(
  identity: Pick<TrustedIdentityWithRoles, 'roles'> | null | undefined,
  communityId?: string | null,
): boolean {
  return (
    identity?.roles.some(
      (role) => isStewardRole(role.role) && roleMatchesCommunity(role, communityId),
    ) ?? false
  );
}

export function isStewardRole(role: UserRoleName): role is 'steward' | 'admin' {
  return role === 'steward' || role === 'admin';
}

export async function requireCurrentTrustedIdentity(
  client?: StewardAuthorizationClient,
): Promise<TrustedIdentityWithRoles> {
  const authClient = client ?? getServerClient();
  const { user, error } = await getCurrentUser(authClient);

  if (error) {
    throw new StewardAuthorizationError(error.message, error.code, error);
  }

  if (!user) {
    throw new StewardAuthorizationError('A signed-in user is required.', 'AUTH_REQUIRED');
  }

  const identity = await getTrustedIdentityByUserId(authClient, user.id);

  if (!identity) {
    throw new StewardAuthorizationError(
      'A trusted identity is required.',
      'TRUSTED_IDENTITY_REQUIRED',
    );
  }

  if (!isActiveTrustedIdentity(identity)) {
    throw new StewardAuthorizationError(
      'An active trusted identity is required.',
      'TRUSTED_IDENTITY_INACTIVE',
    );
  }

  return identity;
}

export async function requireStewardOrAdmin(
  client?: StewardAuthorizationClient,
  options: { communityId?: string | null } = {},
): Promise<TrustedIdentityWithRoles> {
  const identity = await requireCurrentTrustedIdentity(client);

  if (!hasStewardOrAdminRole(identity, options.communityId)) {
    throw new StewardAuthorizationError('A steward or admin role is required.', 'STEWARD_REQUIRED');
  }

  return identity;
}

export function toSafeAuthFailureResult(error: unknown): SafeAuthFailureResult {
  if (error instanceof StewardAuthorizationError) {
    return {
      ok: false,
      error:
        error.code === 'AUTH_REQUIRED' ||
        error.code === 'AUTH_IDENTITY_REQUIRED' ||
        error.code === 'AUTH_USER_LOOKUP_FAILED'
          ? 'auth_required'
          : 'forbidden',
      message:
        error.code === 'AUTH_REQUIRED' ||
        error.code === 'AUTH_IDENTITY_REQUIRED' ||
        error.code === 'AUTH_USER_LOOKUP_FAILED'
          ? 'Authentication is required.'
          : 'You are not authorized to perform this action.',
    };
  }

  return {
    ok: false,
    error: 'forbidden',
    message: 'You are not authorized to perform this action.',
  };
}
