'use server';

import { z } from 'zod';

import { normalizeAuditMetadata } from '@/lib/audit';
import { requireCurrentUser, type SupabaseAuthClient } from '@/lib/auth/session';
import { getTrustedIdentityByUserId, updateTrustedIdentityRoles } from '@/lib/identity';
import { upsertProfile, type ProfileContributionMode } from '@/lib/profiles';
import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/supabase';

const onboardingRoleSchema = z.object({
  selectedRoles: z
    .array(z.literal('member'), {
      invalid_type_error: 'Select at least one valid role.',
      required_error: 'Select at least one role.',
    })
    .min(1, 'Select at least one role.')
    .max(1, 'Only the member role can be selected during onboarding.'),
  contributionMode: z.enum(['job_seeker', 'helper', 'both'], {
    invalid_type_error: 'Select a valid contribution mode.',
    required_error: 'Select a contribution mode.',
  }),
});

export type SaveOnboardingRoleInput = z.input<typeof onboardingRoleSchema>;

export type SafeOnboardingRole = {
  role: Database['public']['Enums']['user_role_name'];
  communityId: string | null;
};

export type SaveOnboardingRoleActionResult =
  | {
      ok: true;
      identityId: string;
      selectedRoles: SafeOnboardingRole[];
      contributionMode: ProfileContributionMode;
    }
  | { ok: false; error: string };

type OnboardingRoleSupabaseClient = SupabaseAuthClient & {
  from(table: 'trusted_identities' | 'user_roles' | 'profiles'): ReturnType<
    import('@/lib/identity').TrustedIdentityRepositoryClient['from']
  >;
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

function validationErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid onboarding role selection.';
}

export async function saveOnboardingRoleAction(
  input: SaveOnboardingRoleInput,
): Promise<SaveOnboardingRoleActionResult> {
  const parsed = onboardingRoleSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationErrorMessage(parsed.error) };
  }

  const supabase = createClient() as unknown as OnboardingRoleSupabaseClient;
  const user = await requireCurrentUser(supabase);
  const identity = await getTrustedIdentityByUserId(supabase, user.id);

  if (!identity) {
    return { ok: false, error: 'A trusted identity is required to choose onboarding roles.' };
  }

  if (identity.status !== 'active') {
    return {
      ok: false,
      error: 'An active trusted identity is required to choose onboarding roles.',
    };
  }

  const selectedRoles = await updateTrustedIdentityRoles(
    supabase,
    identity.id,
    parsed.data.selectedRoles.map((role) => ({ role })),
  );
  const profile = await upsertProfile(supabase, {
    identityId: identity.id,
    contributionMode: parsed.data.contributionMode,
  });

  const { error: auditError } = await supabase.from('audit_events').insert({
    actor_identity_id: identity.id,
    event_type: 'onboarding.role_saved',
    subject_table: 'trusted_identities',
    subject_id: identity.id,
    metadata: normalizeAuditMetadata({
      selectedRoles: selectedRoles.map((role) => role.role),
      contributionMode: profile.contribution_mode,
    }),
  });

  if (auditError) {
    throw auditError;
  }

  return {
    ok: true,
    identityId: identity.id,
    selectedRoles: selectedRoles.map((role) => ({
      role: role.role,
      communityId: role.community_id,
    })),
    contributionMode: profile.contribution_mode ?? parsed.data.contributionMode,
  };
}
