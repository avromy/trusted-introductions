import { beforeEach, describe, expect, it, vi } from 'vitest';

import { completeOnboardingAction } from '@/lib/onboarding/completion-actions';

const { createClientMock, getCurrentOnboardingProgressMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getCurrentOnboardingProgressMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

vi.mock('@/lib/onboarding/server', () => ({
  getCurrentOnboardingProgress: getCurrentOnboardingProgressMock,
}));

function completeProgress() {
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
        roles: ['member'],
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

function incompleteProgress() {
  return {
    ...completeProgress(),
    step: 'profile_required',
    isComplete: false,
    missingRequirements: ['profile'],
    nextRoute: '/onboarding/profile',
    checks: { ...completeProgress().checks, profileComplete: false },
  };
}

function createSupabaseMock() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const client = {
    from: vi.fn((table: string) => {
      if (table === 'audit_events') {
        return { insert };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return { client, insert };
}

describe('completeOnboardingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the current incomplete progress without writing audit events', async () => {
    const progress = incompleteProgress();
    getCurrentOnboardingProgressMock.mockResolvedValueOnce(progress);

    const result = await completeOnboardingAction();

    expect(result).toEqual({
      ok: false,
      error: 'Complete all required onboarding steps before finishing onboarding.',
      progress,
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('writes an audit event and returns complete state without schema persistence', async () => {
    const progress = completeProgress();
    const supabase = createSupabaseMock();
    getCurrentOnboardingProgressMock.mockResolvedValueOnce(progress);
    createClientMock.mockReturnValueOnce(supabase.client);

    const result = await completeOnboardingAction();

    expect(result).toEqual({ ok: true, progress, persisted: false });
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'onboarding.completed',
        actor_type: 'user',
        actor_id: 'identity-123',
        target_type: 'trusted_identity',
        target_id: 'identity-123',
        metadata: expect.objectContaining({
          persisted: false,
          missingRequirements: [],
          checks: progress.checks,
        }),
      }),
    );
  });
});
