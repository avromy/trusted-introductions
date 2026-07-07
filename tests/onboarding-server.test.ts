import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCurrentOnboardingProgress } from '@/lib/onboarding/server';
import { AuthHelperError } from '@/lib/auth/session';

const { requireCurrentUserMock, createClientMock } = vi.hoisted(() => ({
  requireCurrentUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@/lib/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/session')>();
  return {
    ...actual,
    requireCurrentUser: requireCurrentUserMock,
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

type TableRows = Record<string, Record<string, unknown> | null>;

class QueryBuilder {
  constructor(
    private readonly table: string,
    private readonly rows: TableRows,
  ) {}

  select() {
    return this;
  }

  eq() {
    return this;
  }

  or() {
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  async maybeSingle() {
    return { data: this.rows[this.table] ?? null, error: null };
  }
}

function clientFor(rows: TableRows) {
  return {
    from: (table: string) => new QueryBuilder(table, rows),
  };
}

const user = { id: 'user-123', email: 'miriam@example.com' };

describe('getCurrentOnboardingProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentUserMock.mockResolvedValue(user);
  });

  it('requires an authenticated user', async () => {
    const authError = new AuthHelperError('A signed-in user is required.', 'AUTH_REQUIRED');
    requireCurrentUserMock.mockRejectedValue(authError);

    await expect(getCurrentOnboardingProgress()).rejects.toThrow(authError);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('loads identity, profile, privacy, invite, and returns calculated progress', async () => {
    createClientMock.mockReturnValue(
      clientFor({
        trusted_identities: {
          id: 'identity-123',
          status: 'active',
          metadata: { contributionMode: 'introductions' },
          user_id: 'user-123',
        },
        user_roles: { role: 'helper' },
        profiles: {
          id: 'profile-123',
          display_name: 'Miriam Cohen',
          headline: null,
          summary: null,
          completed_at: null,
          identity_id: 'identity-123',
        },
        privacy_settings: {
          profile_visibility: 'members',
          resume_visibility: 'helpers',
          contact_visibility: 'introduction',
          public_meet_page_enabled: false,
          helper_activity_visible: true,
          allow_ai_summary: false,
          identity_id: 'identity-123',
        },
        invitations: {
          status: 'pending',
          expires_at: '2099-01-01T00:00:00.000Z',
        },
      }),
    );

    const progress = await getCurrentOnboardingProgress();

    expect(progress.step).toBe('complete');
    expect(progress.isComplete).toBe(true);
    expect(progress.missingRequirements).toEqual([]);
    expect(progress.state.trustedIdentity).toMatchObject({
      id: 'identity-123',
      status: 'active',
      roles: ['helper'],
      contributionMode: 'introductions',
    });
    expect(progress.state.profile).toMatchObject({
      id: 'profile-123',
      displayName: 'Miriam Cohen',
    });
    expect(progress.state.privacySettings).toMatchObject({
      profileVisibility: 'members',
      resumeVisibility: 'helpers',
      contactVisibility: 'introduction',
      publicMeetPageEnabled: false,
      helperActivityVisible: true,
      allowAiSummary: false,
    });
    expect(progress.state.invite).toEqual({
      status: 'pending',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
  });

  it('does not redirect when onboarding is incomplete', async () => {
    createClientMock.mockReturnValue(
      clientFor({
        trusted_identities: null,
        invitations: null,
      }),
    );

    const progress = await getCurrentOnboardingProgress();

    expect(progress.step).toBe('invite_required');
    expect(progress.nextRoute).toBe('/onboarding/invite');
    expect(progress.isComplete).toBe(false);
  });
});
