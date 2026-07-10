import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveOnboardingPrivacyAction } from '@/app/onboarding/privacy/actions';
import { getDefaultPrivacySettings } from '@/lib/privacy';

const mockSavePrivacySettingsAction = vi.hoisted(() => vi.fn());

vi.mock('@/lib/privacy/actions', () => ({
  savePrivacySettingsAction: mockSavePrivacySettingsAction,
}));

describe('saveOnboardingPrivacyAction', () => {
  beforeEach(() => {
    mockSavePrivacySettingsAction.mockReset();
  });

  it('preserves restrictive defaults when checkbox values are omitted', async () => {
    mockSavePrivacySettingsAction.mockResolvedValueOnce({
      ok: true,
      settings: getDefaultPrivacySettings(),
    });
    const formData = new FormData();
    formData.set('profileVisibility', 'private');
    formData.set('resumeVisibility', 'private');
    formData.set('contactVisibility', 'private');

    const result = await saveOnboardingPrivacyAction({ ok: false, message: null }, formData);

    expect(mockSavePrivacySettingsAction).toHaveBeenCalledWith({
      profileVisibility: 'private',
      resumeVisibility: 'private',
      contactVisibility: 'private',
      publicMeetPageEnabled: false,
      helperActivityVisible: false,
      allowAiSummary: false,
    });
    expect(result).toEqual({ ok: true, message: 'Privacy settings saved.' });
  });

  it('passes selected visibility and enabled sharing settings to the save action', async () => {
    mockSavePrivacySettingsAction.mockResolvedValueOnce({
      ok: true,
      settings: {
        profileVisibility: 'members',
        resumeVisibility: 'helpers',
        contactVisibility: 'members',
        publicMeetPageEnabled: true,
        helperActivityVisible: true,
        allowAiSummary: true,
      },
    });
    const formData = new FormData();
    formData.set('profileVisibility', 'members');
    formData.set('resumeVisibility', 'helpers');
    formData.set('contactVisibility', 'members');
    formData.set('publicMeetPageEnabled', 'on');
    formData.set('helperActivityVisible', 'on');
    formData.set('allowAiSummary', 'on');

    const result = await saveOnboardingPrivacyAction({ ok: false, message: null }, formData);

    expect(mockSavePrivacySettingsAction).toHaveBeenCalledWith({
      profileVisibility: 'members',
      resumeVisibility: 'helpers',
      contactVisibility: 'members',
      publicMeetPageEnabled: true,
      helperActivityVisible: true,
      allowAiSummary: true,
    });
    expect(result).toEqual({ ok: true, message: 'Privacy settings saved.' });
  });
});
