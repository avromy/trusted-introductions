import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CompleteOnboardingPage from '@/app/onboarding/complete/page';
import { getCompletionChecklist, getRoleActions } from '@/app/onboarding/complete/view-model';

import type { CurrentOnboardingProgress } from '@/lib/onboarding/server';

const { getCurrentOnboardingProgressMock } = vi.hoisted(() => ({
  getCurrentOnboardingProgressMock: vi.fn(),
}));

vi.mock('@/lib/onboarding/server', () => ({
  getCurrentOnboardingProgress: getCurrentOnboardingProgressMock,
}));

vi.mock('@/lib/onboarding/completion-actions', () => ({
  completeOnboardingAction: vi.fn(),
}));

function completeProgress(): CurrentOnboardingProgress {
  return {
    step: 'complete',
    isComplete: true,
    missingRequirements: [],
    nextRoute: '/onboarding/complete',
    checks: {
      inviteValid: true,
      trustedIdentityComplete: true,
      roleOrContributionModeComplete: true,
      profileComplete: true,
      privacySettingsComplete: true,
    },
    state: {
      user: { id: 'user-123', email: 'miriam@example.com' },
      trustedIdentity: {
        id: 'identity-123',
        status: 'active',
        roles: ['both' as const],
        contributionMode: null,
      },
      profile: { id: 'profile-123', displayName: 'Miriam Cohen' },
      privacySettings: {
        profileVisibility: 'members',
        resumeVisibility: 'helpers',
        contactVisibility: 'introduction',
        publicMeetPageEnabled: false,
        helperActivityVisible: true,
        allowAiSummary: false,
      },
      invite: { status: 'pending', expiresAt: '2099-01-01T00:00:00.000Z' },
    },
  };
}

function incompleteProgress(): CurrentOnboardingProgress {
  return {
    ...completeProgress(),
    step: 'profile_required',
    isComplete: false,
    missingRequirements: ['profile' as const],
    nextRoute: '/onboarding/profile',
    checks: { ...completeProgress().checks, profileComplete: false },
  };
}

describe('CompleteOnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows checklist, completion action, and role-specific next links when onboarding is complete', async () => {
    getCurrentOnboardingProgressMock.mockResolvedValueOnce(completeProgress());

    const markup = renderToStaticMarkup(await CompleteOnboardingPage());

    expect(markup).toContain('You are ready for trusted introductions');
    expect(markup).toContain('Completion checklist');
    expect(markup).toContain('Complete onboarding');
    expect(markup).toContain('Create a seeker request');
    expect(markup).toContain('/requests/new');
    expect(markup).toContain('Add helper capabilities');
    expect(markup).toContain('/helper/capabilities');
  });

  it('shows incomplete-state guidance and links to the next required step', async () => {
    getCurrentOnboardingProgressMock.mockResolvedValueOnce(incompleteProgress());

    const markup = renderToStaticMarkup(await CompleteOnboardingPage());

    expect(markup).toContain('Finish onboarding to continue');
    expect(markup).toContain('Complete these items first');
    expect(markup).toContain('Finish your member profile');
    expect(markup).toContain('/onboarding/profile');
    expect(markup).not.toContain('Complete onboarding</button>');
  });

  it('builds checklist state from onboarding progress checks', () => {
    const checklist = getCompletionChecklist(incompleteProgress());

    expect(checklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Profile completed', complete: false, href: '/onboarding/profile' }),
        expect.objectContaining({ label: 'Privacy settings confirmed', complete: true }),
      ]),
    );
  });

  it('selects next actions from seeker and helper roles', () => {
    expect(getRoleActions(['job_seeker']).map((action) => action.href)).toContain('/requests/new');
    expect(getRoleActions(['helper']).map((action) => action.href)).toContain('/helper/capabilities');
    expect(getRoleActions(['both']).map((action) => action.href)).toEqual(
      expect.arrayContaining(['/requests/new', '/helper/capabilities']),
    );
  });
});
