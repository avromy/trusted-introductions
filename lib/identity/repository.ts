import type { Database, Json } from '@/types/supabase';

type TrustedIdentityRow = Database['public']['Tables']['trusted_identities']['Row'];
type UserRoleRow = Database['public']['Tables']['user_roles']['Row'];
type TrustedIdentityStatus = Database['public']['Enums']['trusted_identity_status'];
type UserRoleName = Database['public']['Enums']['user_role_name'];

type QueryResult<T> = Promise<{ data: T | null; error: Error | null }>;

export type TrustedIdentityRepositoryClient = {
  from(table: 'trusted_identities' | 'user_roles'): any;
};

export type TrustedIdentityInsert = {
  display_name?: string | null;
  legal_name?: string | null;
  metadata?: Json;
  phone?: string | null;
  primary_email: string;
  status?: TrustedIdentityStatus;
  user_id?: string | null;
};

export type UserRoleInsert = {
  community_id?: string | null;
  granted_by_identity_id?: string | null;
  identity_id: string;
  role: UserRoleName;
};

export type TrustedIdentityWithRoles = TrustedIdentityRow & {
  roles: UserRoleRow[];
};

export type CreateTrustedIdentityInput = Omit<TrustedIdentityInsert, 'primary_email'> & {
  primaryEmail: string;
};

export type TrustedIdentityRoleInput = {
  communityId?: string | null;
  grantedByIdentityId?: string | null;
  role: UserRoleName;
};

export function normalizeIdentityEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function getRolesForIdentity(
  supabase: TrustedIdentityRepositoryClient,
  identityId: string,
): QueryResult<UserRoleRow[]> {
  return supabase.from('user_roles').select('*').eq('identity_id', identityId);
}

async function withRoles(
  supabase: TrustedIdentityRepositoryClient,
  identity: TrustedIdentityRow | null,
): Promise<TrustedIdentityWithRoles | null> {
  if (!identity) {
    return null;
  }

  const { data: roles, error } = await getRolesForIdentity(supabase, identity.id);

  if (error) {
    throw error;
  }

  return { ...identity, roles: roles ?? [] };
}

export async function getTrustedIdentityByUserId(
  supabase: TrustedIdentityRepositoryClient,
  userId: string,
): Promise<TrustedIdentityWithRoles | null> {
  const { data, error } = await supabase
    .from('trusted_identities')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return withRoles(supabase, data);
}

export async function getTrustedIdentityByEmail(
  supabase: TrustedIdentityRepositoryClient,
  email: string,
): Promise<TrustedIdentityWithRoles | null> {
  const { data, error } = await supabase
    .from('trusted_identities')
    .select('*')
    .eq('primary_email', normalizeIdentityEmail(email))
    .maybeSingle();

  if (error) {
    throw error;
  }

  return withRoles(supabase, data);
}

export async function createTrustedIdentity(
  supabase: TrustedIdentityRepositoryClient,
  input: CreateTrustedIdentityInput,
): Promise<TrustedIdentityWithRoles> {
  const { data, error } = await supabase
    .from('trusted_identities')
    .insert({
      display_name: input.display_name ?? null,
      legal_name: input.legal_name ?? null,
      metadata: input.metadata ?? {},
      phone: input.phone ?? null,
      primary_email: normalizeIdentityEmail(input.primaryEmail),
      status: input.status ?? 'pending',
      user_id: input.user_id ?? null,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Trusted identity was not returned after creation.');
  }

  return { ...data, roles: [] };
}

export async function updateTrustedIdentityRoles(
  supabase: TrustedIdentityRepositoryClient,
  identityId: string,
  roles: TrustedIdentityRoleInput[],
): Promise<UserRoleRow[]> {
  const deleteResult = (await supabase
    .from('user_roles')
    .delete()
    .eq('identity_id', identityId)) as unknown as { error: Error | null };

  if (deleteResult.error) {
    throw deleteResult.error;
  }

  if (roles.length === 0) {
    return [];
  }

  const payload = roles.map((role) => ({
    community_id: role.communityId ?? null,
    granted_by_identity_id: role.grantedByIdentityId ?? null,
    identity_id: identityId,
    role: role.role,
  }));

  const { data, error } = await supabase.from('user_roles').insert(payload);

  if (error) {
    throw error;
  }

  return data ?? [];
}
