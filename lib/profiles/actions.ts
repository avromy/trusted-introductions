'use server';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/auth/session';
import type { SupabaseAuthClient } from '@/lib/auth/session';
import { normalizeAuditMetadata } from '@/lib/audit';
import type { Json } from '@/types/supabase';

const profileSetupSchema = z.object({
  displayName: z.string().trim().min(2, 'Display name must be at least 2 characters.').max(120),
  headline: z.string().trim().max(160).optional().default(''),
  summary: z.string().trim().max(1_000).optional().default(''),
  location: z.string().trim().max(120).optional().default(''),
});

export type SaveOnboardingProfileInput = z.input<typeof profileSetupSchema>;

export type SafeOnboardingProfile = {
  id: string;
  identityId: string;
  displayName: string;
  headline: string | null;
  summary: string | null;
  location: string | null;
  completedAt: string | null;
  updatedAt: string;
};

export type SaveOnboardingProfileResult = {
  profile: SafeOnboardingProfile;
};

type TrustedIdentityRow = {
  id: string;
  user_id: string | null;
  status: string;
};

type ProfileRow = {
  id: string;
  identity_id: string;
  display_name: string;
  headline: string | null;
  summary: string | null;
  location: string | null;
  completed_at: string | null;
  updated_at: string;
};

type SupabaseQueryResult<TRow> = Promise<{ data: TRow | null; error: Error | null }>;

type ProfileSetupSupabaseClient = {
  auth: SupabaseAuthClient['auth'];
  from(table: 'trusted_identities'): {
    select(columns: string): {
      eq(column: 'user_id', value: string): {
        maybeSingle(): SupabaseQueryResult<TrustedIdentityRow>;
      };
    };
  };
  from(table: 'profiles'): {
    upsert(
      payload: {
        identity_id: string;
        display_name: string;
        headline: string | null;
        summary: string | null;
        location: string | null;
        completed_at: string;
      },
      options: { onConflict: 'identity_id' },
    ): {
      select(columns: string): {
        single(): SupabaseQueryResult<ProfileRow>;
      };
    };
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

function toNullableText(value: string): string | null {
  return value.length > 0 ? value : null;
}

function toSafeProfile(row: ProfileRow): SafeOnboardingProfile {
  return {
    id: row.id,
    identityId: row.identity_id,
    displayName: row.display_name,
    headline: row.headline,
    summary: row.summary,
    location: row.location,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

async function requireCurrentTrustedIdentity(
  supabase: ProfileSetupSupabaseClient,
): Promise<TrustedIdentityRow> {
  const user = await requireCurrentUser(supabase);
  const { data, error } = await supabase
    .from('trusted_identities')
    .select('id,user_id,status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('A trusted identity is required to set up a profile.');
  }

  if (data.status !== 'active') {
    throw new Error('An active trusted identity is required to set up a profile.');
  }

  return data;
}

export async function saveOnboardingProfileAction(
  input: SaveOnboardingProfileInput,
): Promise<SaveOnboardingProfileResult> {
  const supabase = createClient() as unknown as ProfileSetupSupabaseClient;
  const identity = await requireCurrentTrustedIdentity(supabase);
  const profileInput = profileSetupSchema.parse(input);
  const completedAt = new Date().toISOString();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        identity_id: identity.id,
        display_name: profileInput.displayName,
        headline: toNullableText(profileInput.headline),
        summary: toNullableText(profileInput.summary),
        location: toNullableText(profileInput.location),
        completed_at: completedAt,
      },
      { onConflict: 'identity_id' },
    )
    .select('id,identity_id,display_name,headline,summary,location,completed_at,updated_at')
    .single();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    throw new Error('Unable to save onboarding profile.');
  }

  const { error: auditError } = await supabase.from('audit_events').insert({
    actor_identity_id: identity.id,
    event_type: 'onboarding.profile_saved',
    subject_table: 'profiles',
    subject_id: profile.id,
    metadata: normalizeAuditMetadata({ completedAt }),
  });

  if (auditError) {
    throw auditError;
  }

  return { profile: toSafeProfile(profile) };
}
