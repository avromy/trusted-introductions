import { describe, expect, it } from 'vitest';

import {
  canShowContactInfo,
  canShowHelperActivity,
  canShowPublicProfile,
  canShowResume,
  getDefaultPrivacySettings,
} from '@/lib/privacy';

import type { PrivacySettings } from '@/types/privacy';

describe('privacy helpers', () => {
  it('uses restrictive default privacy settings', () => {
    expect(getDefaultPrivacySettings()).toEqual({
      profileVisibility: 'private',
      resumeVisibility: 'private',
      contactVisibility: 'private',
      publicMeetPageEnabled: false,
      helperActivityVisible: false,
      allowAiSummary: false,
    });
  });

  it('returns a fresh default settings object', () => {
    const first = getDefaultPrivacySettings();
    const second = getDefaultPrivacySettings();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });

  it('keeps public page visibility disabled by default', () => {
    expect(canShowPublicProfile()).toBe(false);
    expect(canShowPublicProfile(null)).toBe(false);
    expect(canShowPublicProfile(getDefaultPrivacySettings())).toBe(false);
    expect(canShowPublicProfile({ publicMeetPageEnabled: true })).toBe(false);
    expect(canShowPublicProfile({ profileVisibility: 'public' })).toBe(false);
  });

  it('shows a public profile only when explicitly enabled and public', () => {
    const settings: PrivacySettings = {
      ...getDefaultPrivacySettings(),
      publicMeetPageEnabled: true,
      profileVisibility: 'public',
    };

    expect(canShowPublicProfile(settings)).toBe(true);
  });

  it('hides contact info unless explicitly allowed', () => {
    expect(canShowContactInfo()).toBe(false);
    expect(canShowContactInfo(getDefaultPrivacySettings())).toBe(false);
    expect(canShowContactInfo({ contactVisibility: 'members' })).toBe(false);
    expect(canShowContactInfo({ contactVisibility: 'helpers' })).toBe(false);
    expect(canShowContactInfo({ contactVisibility: 'public' })).toBe(true);
  });

  it('hides resumes unless explicitly allowed', () => {
    expect(canShowResume()).toBe(false);
    expect(canShowResume(getDefaultPrivacySettings())).toBe(false);
    expect(canShowResume({ resumeVisibility: 'introduction' })).toBe(false);
    expect(canShowResume({ resumeVisibility: 'helpers' })).toBe(false);
    expect(canShowResume({ resumeVisibility: 'public' })).toBe(true);
  });

  it('hides helper activity unless explicitly allowed', () => {
    expect(canShowHelperActivity()).toBe(false);
    expect(canShowHelperActivity(getDefaultPrivacySettings())).toBe(false);
    expect(canShowHelperActivity({ helperActivityVisible: false })).toBe(false);
    expect(canShowHelperActivity({ helperActivityVisible: true })).toBe(true);
  });
});
