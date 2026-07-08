'use server';

import { z } from 'zod';

import { normalizeAuditMetadata } from '@/lib/audit';
import { requireCurrentUser } from '@/lib/auth/session';
import type { SupabaseAuthClient } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/supabase';

const onboardingRoleSchema = z.object({
  role: z.enum(['member', 'steward', 'admin']).default('member'),
  contributionMode: z.enum(['seeking_support', 'offering_help', 'both'], {
    message: 'Choose how you expect to participate.',
  }),
});

export type SaveOnboardingRoleInput = {
  role?: Database['public']['Enums']['user_role_name'];
  contributionMode: string;
};

export type SaveOnboardingRoleResult = {
  identityId: string;
  role: Database['public']['Enums']['user_role_name'];
  contributionMode: string;
};

type TrustedIdentityRow = Pick<
  Database['public']['Tables']['trusted_identities']['Row'],
  'id' | 'status' | 'metadata' | 'user_id'
>;

type RoleRow = Pick<Database['public']['Tables']['user_roles']['Row'], 'role'>;

type RoleSetupSupabaseClient = {
  auth: SupabaseAuthClient['auth'];
  from(table: 'trusted_identities'): {
    select(columns: string): {
      eq(
        column: 'user_id',
        value: string,
      ): {
        maybeSingle(): Promise<{ data: TrustedIdentityRow | null; error: Error | null }>;
      };
    };
    update(payload: { metadata: Json }): {
      eq(column: 'id', value: string): Promise<{ error: Error | null }>;
    };
  };
  from(table: 'user_roles'): {
    delete(): {
      eq(column: 'identity_id', value: string): Promise<{ error: Error | null }>;
    };
    insert(payload: {
      identity_id: string;
      role: Database['public']['Enums']['user_role_name'];
      community_id: null;
      granted_by_identity_id: null;
    }): Promise<{ data: RoleRow[] | null; error: Error | null }>;
  };
  from(table: 'audit_events'): {
    insert(payload: {
      actor_identity_id: string;
      event_type: string;
      subject_table: string;
      subject_id: string;
      metadata: Record<string, Json>;
    }): Promise<{ error: Error | null }>;
  };
};

function metadataObject(metadata: Json): Record<string, Json> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata).filter((entry): entry is [string, Json] => entry[1] !== undefined),
  );
}

async function requireCurrentTrustedIdentity(
  supabase: RoleSetupSupabaseClient,
): Promise<TrustedIdentityRow> {
  const user = await requireCurrentUser(supabase);
  const { data, error } = await supabase
    .from('trusted_identities')
    .select('id,status,metadata,user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('A trusted identity is required to choose an onboarding role.');
  }

  if (data.status !== 'active') {
    throw new Error('An active trusted identity is required to choose an onboarding role.');
  }

  return data;
}

export async function saveOnboardingRoleAction(
  input: SaveOnboardingRoleInput,
): Promise<SaveOnboardingRoleResult> {
  const supabase = createClient() as unknown as RoleSetupSupabaseClient;
  const identity = await requireCurrentTrustedIdentity(supabase);
  const roleInput = onboardingRoleSchema.parse(input);
  const metadata = {
    ...metadataObject(identity.metadata),
    contributionMode: roleInput.contributionMode,
    contribution_mode: roleInput.contributionMode,
  };

  const { error: identityError } = await supabase
    .from('trusted_identities')
    .update({ metadata })
    .eq('id', identity.id);

  if (identityError) {
    throw identityError;
  }

  const deleteResult = await supabase.from('user_roles').delete().eq('identity_id', identity.id);

  if (deleteResult.error) {
    throw deleteResult.error;
  }

  const { error: roleError } = await supabase.from('user_roles').insert({
    identity_id: identity.id,
    role: roleInput.role,
    community_id: null,
    granted_by_identity_id: null,
  });

  if (roleError) {
    throw roleError;
  }

  const { error: auditError } = await supabase.from('audit_events').insert({
    actor_identity_id: identity.id,
    event_type: 'onboarding.role_saved',
    subject_table: 'trusted_identities',
    subject_id: identity.id,
    metadata: normalizeAuditMetadata({
      role: roleInput.role,
      contributionMode: roleInput.contributionMode,
    }),
  });

  if (auditError) {
    throw auditError;
  }

  return {
    identityId: identity.id,
    role: roleInput.role,
    contributionMode: roleInput.contributionMode,
  };
}
