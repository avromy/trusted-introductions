import { calculateOnboardingProgress } from '@/lib/onboarding';

import type {
  OnboardingProgress,
  OnboardingRequirement,
  OnboardingStateInput,
} from '@/lib/onboarding';

export type OnboardingPersistenceStep = OnboardingRequirement | 'complete';

export type OnboardingStepCompletionRow = {
  identity_id: string;
  step: OnboardingPersistenceStep;
  completed_at: string;
};

type SelectResult = {
  data: OnboardingStepCompletionRow[] | null;
  error: { message?: string } | null;
};

type SelectQuery = PromiseLike<SelectResult> & {
  eq(column: string, value: unknown): SelectQuery;
  order(column: string, options?: { ascending?: boolean }): SelectQuery;
};

type OnboardingPersistenceSupabaseClient = {
  from(table: 'onboarding_step_completions'): {
    select(columns: string): SelectQuery;
    upsert(
      payload: OnboardingStepCompletionRow,
      options: { onConflict: string; ignoreDuplicates?: boolean },
    ): PromiseLike<{ error: { message?: string } | null }>;
  };
};

export type PersistedOnboardingCompletionState = Record<OnboardingPersistenceStep, boolean>;

export type OnboardingPersistenceState = {
  identityId: string;
  progress: OnboardingProgress;
  completed: PersistedOnboardingCompletionState;
  persistedCompletions: OnboardingStepCompletionRow[];
};

export type PersistOnboardingStepCompletionInput = {
  identityId: string;
  step: OnboardingPersistenceStep;
  state: OnboardingStateInput;
  completedAt?: Date | string;
};

const PERSISTED_COMPLETION_COLUMNS = 'identity_id,step,completed_at';

const EMPTY_COMPLETION_STATE: PersistedOnboardingCompletionState = {
  invite: false,
  trusted_identity: false,
  role_or_contribution_mode: false,
  profile: false,
  privacy_settings: false,
  complete: false,
};

export function calculatePersistedOnboardingCompletionState(
  progress: OnboardingProgress,
): PersistedOnboardingCompletionState {
  return {
    invite: progress.checks.inviteValid,
    trusted_identity: progress.checks.trustedIdentityComplete,
    role_or_contribution_mode: progress.checks.roleOrContributionModeComplete,
    profile: progress.checks.profileComplete,
    privacy_settings: progress.checks.privacySettingsComplete,
    complete: progress.isComplete,
  };
}

function completionStateFromRows(
  rows: OnboardingStepCompletionRow[],
): PersistedOnboardingCompletionState {
  return rows.reduce<PersistedOnboardingCompletionState>(
    (completed, row) => ({ ...completed, [row.step]: true }),
    { ...EMPTY_COMPLETION_STATE },
  );
}

export async function loadOnboardingPersistenceState(
  supabase: OnboardingPersistenceSupabaseClient,
  identityId: string,
  state: OnboardingStateInput = {},
): Promise<OnboardingPersistenceState> {
  const progress = calculateOnboardingProgress(state);
  const query = supabase
    .from('onboarding_step_completions')
    .select(PERSISTED_COMPLETION_COLUMNS)
    .eq('identity_id', identityId)
    .order('completed_at', { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message ?? 'Unable to load onboarding persistence state.');
  }

  const persistedCompletions = data ?? [];
  const persisted = completionStateFromRows(persistedCompletions);
  const calculated = calculatePersistedOnboardingCompletionState(progress);

  return {
    identityId,
    progress,
    completed: { ...persisted, ...calculated },
    persistedCompletions,
  };
}

export async function persistOnboardingStepCompletion(
  supabase: OnboardingPersistenceSupabaseClient,
  input: PersistOnboardingStepCompletionInput,
): Promise<OnboardingPersistenceState> {
  const progress = calculateOnboardingProgress(input.state);
  const completed = calculatePersistedOnboardingCompletionState(progress);

  if (!completed[input.step]) {
    throw new Error(`Cannot persist incomplete onboarding step: ${input.step}`);
  }

  const completedAt =
    input.completedAt instanceof Date
      ? input.completedAt.toISOString()
      : (input.completedAt ?? new Date().toISOString());
  const { error } = await supabase.from('onboarding_step_completions').upsert(
    {
      identity_id: input.identityId,
      step: input.step,
      completed_at: completedAt,
    },
    { onConflict: 'identity_id,step', ignoreDuplicates: true },
  );

  if (error) {
    throw new Error(error.message ?? 'Unable to persist onboarding step completion.');
  }

  return loadOnboardingPersistenceState(supabase, input.identityId, input.state);
}
