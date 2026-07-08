'use server';

import { savePrivacySettingsAction } from '@/lib/privacy/actions';
import type { PrivacySettings } from '@/types/privacy';

export type OnboardingPrivacyFormState = {
  ok: boolean;
  message: string | null;
};

function readBoolean(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on';
}

function readPrivacySettings(formData: FormData): PrivacySettings {
  return {
    profileVisibility: formData.get('profileVisibility'),
    resumeVisibility: formData.get('resumeVisibility'),
    contactVisibility: formData.get('contactVisibility'),
    publicMeetPageEnabled: readBoolean(formData, 'publicMeetPageEnabled'),
    helperActivityVisible: readBoolean(formData, 'helperActivityVisible'),
    allowAiSummary: readBoolean(formData, 'allowAiSummary'),
  } as PrivacySettings;
}

export async function saveOnboardingPrivacyAction(
  _previousState: OnboardingPrivacyFormState,
  formData: FormData,
): Promise<OnboardingPrivacyFormState> {
  try {
    const result = await savePrivacySettingsAction(readPrivacySettings(formData));

    if (!result.ok) {
      return { ok: false, message: result.error };
    }

    return { ok: true, message: 'Privacy settings saved.' };
  } catch {
    return {
      ok: false,
      message: 'We could not save privacy settings right now. Please try again.',
    };
  }
}
