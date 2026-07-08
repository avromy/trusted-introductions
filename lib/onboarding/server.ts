import { requireCurrentUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { calculateOnboardingProgress } from '@/lib/onboarding';
import { mapPrivacySettingsRow } from '@/lib/privacy/repository';

import type { AuthUser } from '@/lib/auth/session';
import type {
  InviteState,
  OnboardingProgress,
  ProfileState,
  TrustedIdentityState,
} from '@/lib/onboarding';
import type { PrivacySettings } from '@/types/privacy';
import type { Database } from '@/types/supabase';

type QueryResult<Row> = Promise<{ data: Row | null; error: { message?: string } | null }>;

type FilterQuery<Row> = {
  maybeSingle: () => QueryResult<Row>;
  limit: (count: number) => FilterQuery<Row>;
  order: (column: string, options?: { ascending?: boolean }) => FilterQuery<Row>;
  eq: (column: string, value: unknown) => FilterQuery<Row>;
  or: (filters: string) => FilterQuery<Row>;
};

type OnboardingSupabaseClient = {
  from: <Row = unknown>(
    table: string,
  ) => {
    select: (columns: string) => FilterQuery<Row>;
  };
};

type TrustedIdentityRow = Pick<
  Database['public']['Tables']['trusted_identities']['Row'],
  'id' | 'status' | 'metadata' | 'user_id'
>;

type RoleRow = Pick<Database['public']['Tables']['user_roles']['Row'], 'role'>;

type InvitationRow = Pick<
  Database['public']['Tables']['invitations']['Row'],
  'expires_at' | 'status'
>;

type ProfileRow = {
  id: string | null;
  display_name?: string | null;
  headline?: string | null;
  summary?: string | null;
  completed_at?: string | null;
  identity_id?: string | null;
};

type PrivacySettingsRow = {
  profile_visibility?: PrivacySettings['profileVisibility'] | null;
  resume_visibility?: PrivacySettings['resumeVisibility'] | null;
  contact_visibility?: PrivacySettings['contactVisibility'] | null;
  public_meet_page_enabled?: boolean | null;
  helper_activity_visible?: boolean | null;
  allow_ai_summary?: boolean | null;
  identity_id?: string | null;
};

export type OnboardingProgressSourceState = {
  user: AuthUser;
  trustedIdentity: TrustedIdentityState | null;
  profile: ProfileState | null;
  privacySettings: Partial<PrivacySettings> | null;
  invite: InviteState | null;
};

export type CurrentOnboardingProgress = OnboardingProgress & {
  state: OnboardingProgressSourceState;
};

function getOnboardingClient(): OnboardingSupabaseClient {
  return createClient() as unknown as OnboardingSupabaseClient;
}

function metadataString(metadata: TrustedIdentityRow['metadata'], key: string): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const value = metadata[key];
  return typeof value === 'string' ? value : null;
}

async function loadTrustedIdentity(
  client: OnboardingSupabaseClient,
  userId: string,
): Promise<TrustedIdentityRow | null> {
  const { data, error } = await client
    .from<TrustedIdentityRow>('trusted_identities')
    .select('id,status,metadata,user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? 'Unable to load trusted identity.');
  }

  return data;
}

async function loadRoles(client: OnboardingSupabaseClient, identityId: string): Promise<string[]> {
  const { data, error } = await client
    .from<RoleRow>('user_roles')
    .select('role')
    .eq('identity_id', identityId)
    .limit(100)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? 'Unable to load onboarding roles.');
  }

  return data?.role ? [data.role] : [];
}

async function loadProfile(
  client: OnboardingSupabaseClient,
  identityId: string,
): Promise<ProfileState | null> {
  const { data, error } = await client
    .from<ProfileRow>('profiles')
    .select('id,display_name,headline,summary,completed_at,identity_id')
    .eq('identity_id', identityId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? 'Unable to load onboarding profile.');
  }

  return data
    ? {
        id: data.id,
        displayName: data.display_name,
        headline: data.headline,
        summary: data.summary,
        completedAt: data.completed_at,
      }
    : null;
}

async function loadPrivacySettings(
  client: OnboardingSupabaseClient,
  identityId: string,
): Promise<Partial<PrivacySettings> | null> {
  const { data, error } = await client
    .from<PrivacySettingsRow>('privacy_settings')
    .select(
      'profile_visibility,resume_visibility,contact_visibility,public_meet_page_enabled,helper_activity_visible,allow_ai_summary,identity_id',
    )
    .eq('identity_id', identityId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? 'Unable to load onboarding privacy settings.');
  }

  if (!data) {
    return null;
  }

  const storedVisibilityValues = [
    data.profile_visibility,
    data.resume_visibility,
    data.contact_visibility,
  ].map((value) => String(value ?? ''));

  if (storedVisibilityValues.some((value) => value === 'community' || value === 'stewards')) {
    return mapPrivacySettingsRow(data as never);
  }

  return {
    profileVisibility: data.profile_visibility ?? undefined,
    resumeVisibility: data.resume_visibility ?? undefined,
    contactVisibility: data.contact_visibility ?? undefined,
    publicMeetPageEnabled: data.public_meet_page_enabled ?? undefined,
    helperActivityVisible: data.helper_activity_visible ?? true,
    allowAiSummary: data.allow_ai_summary ?? undefined,
  };
}

function normalizeInviteLookupEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? '';
}

async function loadInvite(
  client: OnboardingSupabaseClient,
  user: AuthUser,
  identityId?: string,
): Promise<InviteState | null> {
  const inviteeEmail = normalizeInviteLookupEmail(user.email);
  const query = client
    .from<InvitationRow>('invitations')
    .select('status,expires_at')
    .order('created_at', { ascending: false })
    .limit(1);

  const filteredQuery = identityId
    ? query.or(`redeemed_by_identity_id.eq.${identityId},invitee_email.eq.${inviteeEmail}`)
    : query.eq('invitee_email', inviteeEmail);

  const { data, error } = await filteredQuery.maybeSingle();

  if (error) {
    throw new Error(error.message ?? 'Unable to load onboarding invite.');
  }

  if (!data?.expires_at) {
    return null;
  }

  return {
    status: data.status === 'accepted' ? 'redeemed' : data.status,
    expiresAt: data.expires_at,
  };
}

export async function getCurrentOnboardingProgress(): Promise<CurrentOnboardingProgress> {
  const user = await requireCurrentUser();
  const client = getOnboardingClient();
  const identityRow = await loadTrustedIdentity(client, user.id);
  const identityId = identityRow?.id;

  const [roles, profile, privacySettings, invite] = identityId
    ? await Promise.all([
        loadRoles(client, identityId),
        loadProfile(client, identityId),
        loadPrivacySettings(client, identityId),
        loadInvite(client, user, identityId),
      ])
    : [[], null, null, await loadInvite(client, user)];

  const identityStatus: TrustedIdentityState['status'] = identityRow
    ? identityRow.status === 'active'
      ? 'active'
      : identityRow.status === 'suspended'
        ? 'suspended'
        : 'inactive'
    : undefined;
  const trustedIdentity: TrustedIdentityState | null = identityRow
    ? {
        id: identityRow.id,
        status: identityStatus,
        roles: roles as TrustedIdentityState['roles'],
        contributionMode: metadataString(identityRow.metadata, 'contributionMode'),
      }
    : null;

  const state = { user, trustedIdentity, profile, privacySettings, invite };
  return { ...calculateOnboardingProgress(state), state };
}
