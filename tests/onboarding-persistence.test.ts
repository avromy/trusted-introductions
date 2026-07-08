import { describe, expect, it, vi } from 'vitest';

import {
  calculatePersistedOnboardingCompletionState,
  loadOnboardingPersistenceState,
  persistOnboardingStepCompletion,
} from '@/lib/onboarding/persistence';

import type { OnboardingStateInput } from '@/lib/onboarding';
import type { OnboardingStepCompletionRow } from '@/lib/onboarding/persistence';

const completeState: OnboardingStateInput = {
  invite: { status: 'pending', expiresAt: '2099-01-01T00:00:00.000Z' },
  trustedIdentity: {
    id: 'identity-123',
    status: 'active',
    roles: ['helper'],
  },
  profile: {
    id: 'profile-123',
    displayName: 'Miriam Cohen',
  },
  privacySettings: {
    profileVisibility: 'members',
    resumeVisibility: 'helpers',
    contactVisibility: 'introduction',
    publicMeetPageEnabled: false,
    helperActivityVisible: true,
    allowAiSummary: false,
  },
  now: '2026-07-08T00:00:00.000Z',
};

function createPersistenceClient(rows: OnboardingStepCompletionRow[] = []) {
  const state = {
    rows: [...rows],
    filters: [] as Array<{ column: string; value: unknown }>,
    orders: [] as Array<{ column: string; options?: { ascending?: boolean } }>,
    upserts: [] as Array<{ payload: OnboardingStepCompletionRow; options: unknown }>,
  };

  const client = {
    from: vi.fn((table: 'onboarding_step_completions') => ({
      select: vi.fn(() => {
        const query = {
          eq(column: string, value: unknown) {
            state.filters.push({ column, value });
            return query;
          },
          order(column: string, options?: { ascending?: boolean }) {
            state.orders.push({ column, options });
            return query;
          },
          then<TResult1 = { data: OnboardingStepCompletionRow[]; error: null }, TResult2 = never>(
            onfulfilled?:
              | ((value: {
                  data: OnboardingStepCompletionRow[];
                  error: null;
                }) => TResult1 | PromiseLike<TResult1>)
              | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
          ) {
            return Promise.resolve({ data: state.rows, error: null }).then(onfulfilled, onrejected);
          },
        };
        return query;
      }),
      upsert: vi.fn(async (payload: OnboardingStepCompletionRow, options: unknown) => {
        state.upserts.push({ payload, options });
        state.rows = [
          ...state.rows.filter(
            (row) => row.identity_id !== payload.identity_id || row.step !== payload.step,
          ),
          payload,
        ];
        return { error: null };
      }),
    })),
  };

  return { client, state };
}

describe('onboarding persistence service', () => {
  it('calculates completion state from existing onboarding progress helpers', () => {
    const state = calculatePersistedOnboardingCompletionState({
      step: 'profile_required',
      isComplete: false,
      missingRequirements: ['profile', 'privacy_settings'],
      nextRoute: '/onboarding/profile',
      checks: {
        inviteValid: true,
        trustedIdentityComplete: true,
        roleOrContributionModeComplete: true,
        profileComplete: false,
        privacySettingsComplete: false,
      },
    });

    expect(state).toEqual({
      invite: true,
      trusted_identity: true,
      role_or_contribution_mode: true,
      profile: false,
      privacy_settings: false,
      complete: false,
    });
  });

  it('loads persisted rows and overlays calculated completion state', async () => {
    const { client, state } = createPersistenceClient([
      {
        identity_id: 'identity-123',
        step: 'invite',
        completed_at: '2026-07-08T00:00:00.000Z',
      },
    ]);

    const persistence = await loadOnboardingPersistenceState(client, 'identity-123', completeState);

    expect(persistence.progress.step).toBe('complete');
    expect(persistence.completed).toEqual({
      invite: true,
      trusted_identity: true,
      role_or_contribution_mode: true,
      profile: true,
      privacy_settings: true,
      complete: true,
    });
    expect(persistence.persistedCompletions).toHaveLength(1);
    expect(state.filters).toEqual([{ column: 'identity_id', value: 'identity-123' }]);
    expect(state.orders).toEqual([{ column: 'completed_at', options: { ascending: true } }]);
  });

  it('upserts only completed onboarding steps', async () => {
    const { client, state } = createPersistenceClient();

    await persistOnboardingStepCompletion(client, {
      identityId: 'identity-123',
      step: 'profile',
      state: completeState,
      completedAt: new Date('2026-07-08T12:00:00.000Z'),
    });

    expect(state.upserts).toEqual([
      {
        payload: {
          identity_id: 'identity-123',
          step: 'profile',
          completed_at: '2026-07-08T12:00:00.000Z',
        },
        options: { onConflict: 'identity_id,step', ignoreDuplicates: true },
      },
    ]);
  });

  it('rejects persistence for steps that helper calculations still mark incomplete', async () => {
    const { client, state } = createPersistenceClient();

    await expect(
      persistOnboardingStepCompletion(client, {
        identityId: 'identity-123',
        step: 'privacy_settings',
        state: { ...completeState, privacySettings: null },
      }),
    ).rejects.toThrow('Cannot persist incomplete onboarding step: privacy_settings');

    expect(state.upserts).toEqual([]);
  });
});
