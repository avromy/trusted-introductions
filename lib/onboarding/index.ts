import type { Invite, TrustedIdentity, UserRole } from '@/types/domain';
import type { PrivacySettings } from '@/types/privacy';

export const ONBOARDING_ROUTE_HINTS = {
  invite: '/onboarding/invite',
  trustedIdentity: '/onboarding/invite',
  role: '/onboarding/role',
  profile: '/onboarding/profile',
  privacy: '/onboarding/privacy',
  complete: '/onboarding/complete',
} as const;

export type OnboardingStep =
  | 'invite_required'
  | 'trusted_identity_required'
  | 'role_required'
  | 'profile_required'
  | 'privacy_required'
  | 'complete';

export type OnboardingRequirement =
  | 'invite'
  | 'trusted_identity'
  | 'role_or_contribution_mode'
  | 'profile'
  | 'privacy_settings';

export type InviteState = Pick<Invite, 'status' | 'expiresAt'> | { valid: boolean };

export type TrustedIdentityState = Partial<Pick<TrustedIdentity, 'id' | 'status' | 'roles'>> & {
  contributionMode?: string | null;
};

export type ProfileState = {
  id?: string | null;
  displayName?: string | null;
  headline?: string | null;
  summary?: string | null;
  completedAt?: string | null;
};

export type OnboardingStateInput = {
  invite?: InviteState | null;
  trustedIdentity?: TrustedIdentityState | null;
  profile?: ProfileState | null;
  privacySettings?: Partial<PrivacySettings> | null;
  now?: Date | string | number;
};

export type OnboardingProgress = {
  step: OnboardingStep;
  isComplete: boolean;
  missingRequirements: OnboardingRequirement[];
  nextRoute: (typeof ONBOARDING_ROUTE_HINTS)[keyof typeof ONBOARDING_ROUTE_HINTS];
  checks: {
    inviteValid: boolean;
    trustedIdentityComplete: boolean;
    roleOrContributionModeComplete: boolean;
    profileComplete: boolean;
    privacySettingsComplete: boolean;
  };
};

function isValidRole(role: unknown): role is UserRole {
  return typeof role === 'string' && role.length > 0;
}

export function isInviteValid(invite?: InviteState | null, now: Date = new Date()): boolean {
  if (!invite) {
    return false;
  }

  if ('valid' in invite) {
    return invite.valid === true;
  }

  if (invite.status !== 'pending') {
    return false;
  }

  const expiresAt = Date.parse(invite.expiresAt);

  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

export function isTrustedIdentityComplete(identity?: TrustedIdentityState | null): boolean {
  return Boolean(identity?.id) && (identity?.status ?? 'active') === 'active';
}

export function hasRoleOrContributionMode(identity?: TrustedIdentityState | null): boolean {
  const hasRole = Array.isArray(identity?.roles) && identity.roles.some(isValidRole);
  const hasContributionMode =
    typeof identity?.contributionMode === 'string' && identity.contributionMode.trim().length > 0;

  return hasRole || hasContributionMode;
}

export function isProfileComplete(profile?: ProfileState | null): boolean {
  return Boolean(
    profile?.completedAt ||
      (profile?.id && (profile.displayName?.trim() || profile.headline?.trim() || profile.summary?.trim())),
  );
}

export function isPrivacySettingsComplete(settings?: Partial<PrivacySettings> | null): boolean {
  return Boolean(
    settings?.profileVisibility &&
      settings.resumeVisibility &&
      settings.contactVisibility &&
      typeof settings.publicMeetPageEnabled === 'boolean' &&
      typeof settings.helperActivityVisible === 'boolean' &&
      typeof settings.allowAiSummary === 'boolean',
  );
}

export function getMissingOnboardingRequirements(
  input: OnboardingStateInput,
): OnboardingRequirement[] {
  const now = input.now ? new Date(input.now) : new Date();
  const missing: OnboardingRequirement[] = [];

  if (!isInviteValid(input.invite, now)) {
    missing.push('invite');
  }

  if (!isTrustedIdentityComplete(input.trustedIdentity)) {
    missing.push('trusted_identity');
  }

  if (!hasRoleOrContributionMode(input.trustedIdentity)) {
    missing.push('role_or_contribution_mode');
  }

  if (!isProfileComplete(input.profile)) {
    missing.push('profile');
  }

  if (!isPrivacySettingsComplete(input.privacySettings)) {
    missing.push('privacy_settings');
  }

  return missing;
}

export function getOnboardingRouteHint(step: OnboardingStep): OnboardingProgress['nextRoute'] {
  switch (step) {
    case 'invite_required':
      return ONBOARDING_ROUTE_HINTS.invite;
    case 'trusted_identity_required':
      return ONBOARDING_ROUTE_HINTS.trustedIdentity;
    case 'role_required':
      return ONBOARDING_ROUTE_HINTS.role;
    case 'profile_required':
      return ONBOARDING_ROUTE_HINTS.profile;
    case 'privacy_required':
      return ONBOARDING_ROUTE_HINTS.privacy;
    case 'complete':
      return ONBOARDING_ROUTE_HINTS.complete;
  }
}

export function calculateOnboardingProgress(input: OnboardingStateInput = {}): OnboardingProgress {
  const now = input.now ? new Date(input.now) : new Date();
  const checks = {
    inviteValid: isInviteValid(input.invite, now),
    trustedIdentityComplete: isTrustedIdentityComplete(input.trustedIdentity),
    roleOrContributionModeComplete: hasRoleOrContributionMode(input.trustedIdentity),
    profileComplete: isProfileComplete(input.profile),
    privacySettingsComplete: isPrivacySettingsComplete(input.privacySettings),
  };

  const step: OnboardingStep = !checks.inviteValid
    ? 'invite_required'
    : !checks.trustedIdentityComplete
      ? 'trusted_identity_required'
      : !checks.roleOrContributionModeComplete
        ? 'role_required'
        : !checks.profileComplete
          ? 'profile_required'
          : !checks.privacySettingsComplete
            ? 'privacy_required'
            : 'complete';

  return {
    step,
    isComplete: step === 'complete',
    missingRequirements: getMissingOnboardingRequirements(input),
    nextRoute: getOnboardingRouteHint(step),
    checks,
  };
}
export {
  saveOnboardingRoleAction,
  type SaveOnboardingRoleActionResult,
  type SaveOnboardingRoleInput,
} from './role-actions';
