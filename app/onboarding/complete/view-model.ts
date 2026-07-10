import type { CurrentOnboardingProgress } from '@/lib/onboarding/server';
import type { UserRole } from '@/types/domain';

export type ChecklistItem = {
  label: string;
  complete: boolean;
  href: string;
};

export type RoleAction = {
  href: string;
  label: string;
  description: string;
  primary?: boolean;
};

export const requirementLabels: Record<string, string> = {
  invite: 'Accept a valid invitation',
  trusted_identity: 'Create your trusted identity',
  role_or_contribution_mode: 'Choose how you want to participate',
  profile: 'Finish your member profile',
  privacy_settings: 'Confirm privacy settings',
};

export function getCompletionChecklist(progress: CurrentOnboardingProgress): ChecklistItem[] {
  return [
    { label: 'Invitation accepted', complete: progress.checks.inviteValid, href: '/onboarding/invite' },
    {
      label: 'Trusted identity active',
      complete: progress.checks.trustedIdentityComplete,
      href: '/onboarding/invite',
    },
    {
      label: 'Role selected',
      complete: progress.checks.roleOrContributionModeComplete,
      href: '/onboarding/role',
    },
    { label: 'Profile completed', complete: progress.checks.profileComplete, href: '/onboarding/profile' },
    {
      label: 'Privacy settings confirmed',
      complete: progress.checks.privacySettingsComplete,
      href: '/onboarding/privacy',
    },
  ];
}

export function getRoleActions(roles: readonly UserRole[] = []): RoleAction[] {
  const selected = new Set(roles);
  const actions: RoleAction[] = [];

  if (selected.has('job_seeker') || selected.has('both')) {
    actions.push({
      href: '/requests/new',
      label: 'Create a seeker request',
      description: 'Share what kind of introduction would help you next.',
      primary: true,
    });
    actions.push({
      href: '/job-seeker',
      label: 'Review seeker workspace',
      description: 'See the seeker flow and keep your request context current.',
    });
  }

  if (selected.has('helper') || selected.has('both')) {
    actions.push({
      href: '/helper/capabilities',
      label: 'Add helper capabilities',
      description: 'Tell stewards where you are most comfortable helping.',
      primary: actions.length === 0,
    });
    actions.push({
      href: '/helper',
      label: 'Open helper workspace',
      description: 'Review ways to support trusted introductions.',
    });
  }

  if (actions.length === 0) {
    actions.push({
      href: '/dashboard',
      label: 'Go to your dashboard',
      description: 'Start from your member home while your role-specific flow becomes available.',
      primary: true,
    });
  }

  return actions;
}

export function formatMissingRequirement(requirement: string): string {
  return requirementLabels[requirement] ?? requirement.replaceAll('_', ' ');
}
