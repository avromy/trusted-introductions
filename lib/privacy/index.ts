import type { PrivacySettings } from '@/types/privacy';

export type { PrivacySettings } from '@/types/privacy';

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  profileVisibility: 'private',
  resumeVisibility: 'private',
  contactVisibility: 'private',
  publicMeetPageEnabled: false,
  helperActivityVisible: false,
  allowAiSummary: false,
};

export function getDefaultPrivacySettings(): PrivacySettings {
  return { ...DEFAULT_PRIVACY_SETTINGS };
}

export function canShowPublicProfile(settings?: Partial<PrivacySettings> | null): boolean {
  return settings?.publicMeetPageEnabled === true && settings.profileVisibility === 'public';
}

export function canShowResume(settings?: Partial<PrivacySettings> | null): boolean {
  return settings?.resumeVisibility === 'public';
}

export function canShowContactInfo(settings?: Partial<PrivacySettings> | null): boolean {
  return settings?.contactVisibility === 'public';
}

export function canShowHelperActivity(settings?: Partial<PrivacySettings> | null): boolean {
  return settings?.helperActivityVisible === true;
}

export {
  createPrivacySettingsUpsertPayload,
  ensureDefaultPrivacySettings,
  getPrivacySettingsByIdentityId,
  mapPrivacySettingsRow,
  upsertPrivacySettings,
  type PrivacySettingsInput,
  type PrivacySettingsSupabaseClient,
  type PrivacySettingsUpsertPayload,
} from './repository';
