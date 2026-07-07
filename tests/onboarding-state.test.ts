import { describe, expect, it } from 'vitest';

import {
  calculateOnboardingProgress,
  getMissingOnboardingRequirements,
  getOnboardingRouteHint,
  hasRoleOrContributionMode,
  isInviteValid,
  isPrivacySettingsComplete,
  isProfileComplete,
  isTrustedIdentityComplete,
  ONBOARDING_ROUTE_HINTS,
} from '@/lib/onboarding';
import { getDefaultPrivacySettings } from '@/lib/privacy';

import type { OnboardingStateInput } from '@/lib/onboarding';

const NOW = new Date('2026-07-07T00:00:00.000Z');

const validInvite = {
  status: 'pending' as const,
  expiresAt: '2026-07-08T00:00:00.000Z',
};

const activeIdentity = {
  id: 'identity-123',
  status: 'active' as const,
  roles: ['helper' as const],
};

const completeProfile = {
  id: 'profile-123',
  displayName: 'Miriam Cohen',
};

const completeState: OnboardingStateInput = {
  invite: validInvite,
  trustedIdentity: activeIdentity,
  profile: completeProfile,
  privacySettings: getDefaultPrivacySettings(),
  now: NOW,
};

describe('onboarding state helpers', () => {
  it('requires an invite when invite state is missing', () => {
    const progress = calculateOnboardingProgress({ now: NOW });

    expect(progress.step).toBe('invite_required');
    expect(progress.nextRoute).toBe('/onboarding/invite');
    expect(progress.isComplete).toBe(false);
    expect(progress.missingRequirements).toEqual([
      'invite',
      'trusted_identity',
      'role_or_contribution_mode',
      'profile',
      'privacy_settings',
    ]);
  });

  it('requires trusted identity when invite is valid but identity is missing', () => {
    const progress = calculateOnboardingProgress({ invite: validInvite, now: NOW });

    expect(progress.step).toBe('trusted_identity_required');
    expect(progress.nextRoute).toBe('/onboarding/invite');
    expect(progress.checks.inviteValid).toBe(true);
    expect(progress.missingRequirements).toContain('trusted_identity');
  });

  it('requires a role or contribution mode before profile when identity has no role', () => {
    const progress = calculateOnboardingProgress({
      invite: validInvite,
      trustedIdentity: { id: 'identity-123', status: 'active', roles: [] },
      now: NOW,
    });

    expect(progress.step).toBe('role_required');
    expect(progress.nextRoute).toBe('/onboarding/role');
  });

  it('requires profile when identity has role or contribution mode but no profile', () => {
    const progress = calculateOnboardingProgress({
      invite: validInvite,
      trustedIdentity: activeIdentity,
      now: NOW,
    });

    expect(progress.step).toBe('profile_required');
    expect(progress.nextRoute).toBe('/onboarding/profile');
    expect(progress.missingRequirements).toContain('profile');
  });

  it('requires privacy settings when profile exists without privacy settings', () => {
    const progress = calculateOnboardingProgress({
      invite: validInvite,
      trustedIdentity: activeIdentity,
      profile: completeProfile,
      now: NOW,
    });

    expect(progress.step).toBe('privacy_required');
    expect(progress.nextRoute).toBe('/onboarding/privacy');
    expect(progress.missingRequirements).toEqual(['privacy_settings']);
  });

  it('marks onboarding complete when all requirements are present', () => {
    const progress = calculateOnboardingProgress(completeState);

    expect(progress.step).toBe('complete');
    expect(progress.nextRoute).toBe('/onboarding/complete');
    expect(progress.isComplete).toBe(true);
    expect(progress.missingRequirements).toEqual([]);
    expect(progress.checks).toEqual({
      inviteValid: true,
      trustedIdentityComplete: true,
      roleOrContributionModeComplete: true,
      profileComplete: true,
      privacySettingsComplete: true,
    });
  });

  it('uses conservative defaults for partial and null data', () => {
    expect(isInviteValid(null, NOW)).toBe(false);
    expect(isInviteValid({ status: 'pending', expiresAt: 'not-a-date' }, NOW)).toBe(false);
    expect(isTrustedIdentityComplete({ id: 'identity-123', status: 'suspended' })).toBe(false);
    expect(hasRoleOrContributionMode({ id: 'identity-123', roles: [] })).toBe(false);
    expect(isProfileComplete({ id: 'profile-123' })).toBe(false);
    expect(isPrivacySettingsComplete({ profileVisibility: 'private' })).toBe(false);

    expect(calculateOnboardingProgress({ invite: { valid: false }, trustedIdentity: null, now: NOW }).step).toBe(
      'invite_required',
    );
    expect(getMissingOnboardingRequirements({ invite: { valid: true }, now: NOW })).toEqual([
      'trusted_identity',
      'role_or_contribution_mode',
      'profile',
      'privacy_settings',
    ]);
  });

  it('returns safe route hints without redirect side effects', () => {
    expect(ONBOARDING_ROUTE_HINTS).toEqual({
      invite: '/onboarding/invite',
      trustedIdentity: '/onboarding/invite',
      role: '/onboarding/role',
      profile: '/onboarding/profile',
      privacy: '/onboarding/privacy',
      complete: '/onboarding/complete',
    });
    expect(getOnboardingRouteHint('complete')).toBe('/onboarding/complete');
  });
});
