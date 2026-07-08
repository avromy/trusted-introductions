import type { Database, Json } from '@/types/supabase';

type TrustedIdentityRow = Database['public']['Tables']['trusted_identities']['Row'];
type UserRoleRow = Database['public']['Tables']['user_roles']['Row'];
type UserRoleName = Database['public']['Enums']['user_role_name'];

type RolesSelectResult = Promise<{ data: UserRoleRow[] | null; error: Error | null }>;
type RolesDeleteResult = Promise<{ error: Error | null }>;
type RolesInsertResult = Promise<{ data: UserRoleRow[] | null; error: Error | null }>;
type IdentitySelectResult = Promise<{ data: TrustedIdentityRow | null; error: Error | null }>;
type IdentityUpdateResult = Promise<{ data: TrustedIdentityRow | null; error: Error | null }>;

type RoleSelectQuery = {
  eq(column: 'identity_id', value: string): RolesSelectResult;
};

type RoleDeleteQuery = {
  eq(column: 'identity_id', value: string): RolesDeleteResult;
};

type RoleInsertQuery = {
  select(columns?: string): RolesInsertResult;
};

type IdentitySelectQuery = {
  eq(
    column: 'id',
    value: string,
  ): {
    maybeSingle(): IdentitySelectResult;
  };
};

type IdentityUpdateQuery = {
  eq(
    column: 'id',
    value: string,
  ): {
    select(columns?: string): {
      single(): IdentityUpdateResult;
    };
  };
};

export type OnboardingRoleRepositoryClient = {
  from(table: 'user_roles'): {
    select(columns?: string): RoleSelectQuery;
    delete(): RoleDeleteQuery;
    insert(payload: UserRoleInsertPayload[]): RoleInsertQuery;
  };
  from(table: 'trusted_identities'): {
    select(columns?: string): IdentitySelectQuery;
    update(payload: { metadata: Json }): IdentityUpdateQuery;
  };
};

export type OnboardingRoleInput = {
  role: UserRoleName;
  communityId?: string | null;
  grantedByIdentityId?: string | null;
};

export type UserRoleInsertPayload = {
  identity_id: string;
  role: UserRoleName;
  community_id: string | null;
  granted_by_identity_id: string | null;
};

const ROLE_COLUMNS =
  'id, identity_id, community_id, role, granted_by_identity_id, created_at, updated_at';
const TRUSTED_IDENTITY_COLUMNS =
  'id, user_id, primary_email, display_name, legal_name, phone, metadata, status, created_at, updated_at';

function requireIdentityId(identityId: string): void {
  if (identityId.trim().length === 0) {
    throw new Error('Onboarding identity id is required.');
  }
}

function metadataRecord(metadata: Json): Record<string, Json> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return { ...metadata } as Record<string, Json>;
}

function contributionMetadata(mode: string | null): Record<string, Json> {
  return {
    contributionMode: mode,
    contribution_mode: mode,
  };
}

export async function getCurrentRolesForIdentity(
  supabase: OnboardingRoleRepositoryClient,
  identityId: string,
): Promise<UserRoleRow[]> {
  requireIdentityId(identityId);

  const { data, error } = await supabase
    .from('user_roles')
    .select(ROLE_COLUMNS)
    .eq('identity_id', identityId);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function replaceRolesForIdentity(
  supabase: OnboardingRoleRepositoryClient,
  identityId: string,
  roles: OnboardingRoleInput[],
): Promise<UserRoleRow[]> {
  requireIdentityId(identityId);

  const deleteResult = await supabase.from('user_roles').delete().eq('identity_id', identityId);

  if (deleteResult.error) {
    throw deleteResult.error;
  }

  if (roles.length === 0) {
    return [];
  }

  const payload = roles.map((role) => ({
    identity_id: identityId,
    role: role.role,
    community_id: role.communityId ?? null,
    granted_by_identity_id: role.grantedByIdentityId ?? null,
  }));

  const { data, error } = await supabase.from('user_roles').insert(payload).select(ROLE_COLUMNS);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function saveContributionModeForIdentity(
  supabase: OnboardingRoleRepositoryClient,
  identityId: string,
  contributionMode: string | null,
): Promise<TrustedIdentityRow> {
  requireIdentityId(identityId);

  const { data: identity, error: selectError } = await supabase
    .from('trusted_identities')
    .select(TRUSTED_IDENTITY_COLUMNS)
    .eq('id', identityId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (!identity) {
    throw new Error('Trusted identity was not found.');
  }

  const trimmedMode = contributionMode?.trim() ? contributionMode.trim() : null;
  const metadata = {
    ...metadataRecord(identity.metadata),
    ...contributionMetadata(trimmedMode),
  };

  const { data, error } = await supabase
    .from('trusted_identities')
    .update({ metadata })
    .eq('id', identityId)
    .select(TRUSTED_IDENTITY_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Contribution mode update did not return a row.');
  }

  return data;
}
