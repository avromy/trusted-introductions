import { getDefaultPrivacySettings } from '@/lib/privacy';
import type { PrivacySettings } from '@/types/privacy';
import type { Database } from '@/types/supabase';

type PrivacySettingsRow = Database['public']['Tables']['privacy_settings']['Row'];
type StoredPrivacyVisibility = Database['public']['Enums']['privacy_visibility'];

type PrivacySettingsSelectResult = {
  data: PrivacySettingsRow | null;
  error: Error | null;
};

type PrivacySettingsMutationResult = {
  data: PrivacySettingsRow | null;
  error: Error | null;
};

type PrivacySettingsQueryBuilder = {
  select(columns: string): PrivacySettingsQueryBuilder;
  eq(column: 'identity_id', value: string): PrivacySettingsQueryBuilder;
  maybeSingle(): Promise<PrivacySettingsSelectResult>;
};

type PrivacySettingsUpsertBuilder = {
  select(columns: string): PrivacySettingsUpsertBuilder;
  single(): Promise<PrivacySettingsMutationResult>;
};

export type PrivacySettingsUpsertPayload = {
  identity_id: string;
  profile_visibility: StoredPrivacyVisibility;
  contact_visibility: StoredPrivacyVisibility;
  resume_visibility: StoredPrivacyVisibility;
  allow_ai_summary: boolean;
  public_meet_page_enabled: boolean;
};

export type PrivacySettingsSupabaseClient = {
  from(table: 'privacy_settings'): PrivacySettingsQueryBuilder & {
    upsert(
      payload: PrivacySettingsUpsertPayload,
      options: { onConflict: 'identity_id' },
    ): PrivacySettingsUpsertBuilder;
  };
};

export type PrivacySettingsInput = Partial<PrivacySettings>;

const PRIVACY_SETTINGS_SELECT_COLUMNS =
  'id, identity_id, profile_visibility, contact_visibility, resume_visibility, allow_ai_summary, public_meet_page_enabled, created_at, updated_at';

function toStoredVisibility(visibility: string | undefined): StoredPrivacyVisibility {
  switch (visibility) {
    case 'helpers':
      return 'stewards';
    case 'members':
    case 'introduction':
    case 'public':
      return 'community';
    case 'private':
    default:
      return 'private';
  }
}

function fromStoredProfileVisibility(
  visibility: StoredPrivacyVisibility,
): PrivacySettings['profileVisibility'] {
  return visibility === 'community' ? 'members' : 'private';
}

function fromStoredSensitiveVisibility(
  visibility: StoredPrivacyVisibility,
): PrivacySettings['contactVisibility'] {
  if (visibility === 'stewards') {
    return 'helpers';
  }

  if (visibility === 'community') {
    return 'members';
  }

  return 'private';
}

export function mapPrivacySettingsRow(row: PrivacySettingsRow): PrivacySettings {
  return {
    ...getDefaultPrivacySettings(),
    profileVisibility: fromStoredProfileVisibility(row.profile_visibility),
    contactVisibility: fromStoredSensitiveVisibility(row.contact_visibility),
    resumeVisibility: fromStoredSensitiveVisibility(row.resume_visibility),
    allowAiSummary: row.allow_ai_summary,
    publicMeetPageEnabled: row.public_meet_page_enabled,
  };
}

export function createPrivacySettingsUpsertPayload(
  identityId: string,
  settings: PrivacySettingsInput = {},
): PrivacySettingsUpsertPayload {
  const defaults = getDefaultPrivacySettings();
  const merged = { ...defaults, ...settings };

  return {
    identity_id: identityId,
    profile_visibility: toStoredVisibility(merged.profileVisibility),
    contact_visibility: toStoredVisibility(merged.contactVisibility),
    resume_visibility: toStoredVisibility(merged.resumeVisibility),
    allow_ai_summary: merged.allowAiSummary,
    public_meet_page_enabled: merged.publicMeetPageEnabled,
  };
}

export async function getPrivacySettingsByIdentityId(
  supabase: PrivacySettingsSupabaseClient,
  identityId: string,
): Promise<PrivacySettings | null> {
  const { data, error } = await supabase
    .from('privacy_settings')
    .select(PRIVACY_SETTINGS_SELECT_COLUMNS)
    .eq('identity_id', identityId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data === null ? null : mapPrivacySettingsRow(data);
}

export async function upsertPrivacySettings(
  supabase: PrivacySettingsSupabaseClient,
  identityId: string,
  settings: PrivacySettingsInput,
): Promise<PrivacySettings> {
  const { data, error } = await supabase
    .from('privacy_settings')
    .upsert(createPrivacySettingsUpsertPayload(identityId, settings), { onConflict: 'identity_id' })
    .select(PRIVACY_SETTINGS_SELECT_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  if (data === null) {
    throw new Error('Privacy settings upsert did not return a row.');
  }

  return mapPrivacySettingsRow(data);
}

export async function ensureDefaultPrivacySettings(
  supabase: PrivacySettingsSupabaseClient,
  identityId: string,
): Promise<PrivacySettings> {
  const existingSettings = await getPrivacySettingsByIdentityId(supabase, identityId);

  if (existingSettings !== null) {
    return existingSettings;
  }

  return upsertPrivacySettings(supabase, identityId, getDefaultPrivacySettings());
}
