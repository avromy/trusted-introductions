'use server';

import {
  hasStewardOrAdminRole,
  requireCurrentTrustedIdentity,
  toSafeAuthFailureResult,
} from '@/lib/auth/steward';
import {
  getIntroductionById,
  type IntroductionRepositoryClient,
} from '@/lib/introductions/repository';
import { createClient } from '@/lib/supabase/server';
import {
  captureIntroductionOutcome,
  isIntroductionOutcome,
  type IntroductionOutcome,
} from '@/lib/introductions/outcomes';

export type IntroductionOutcomeActionResult =
  | { ok: true; outcome: ReturnType<typeof captureIntroductionOutcome>['outcome'] }
  | { ok: false; error: 'validation' | 'not_found'; message: string }
  | { ok: false; error: 'auth_required' | 'forbidden'; message: string };

export type IntroductionOutcomeActionClient = Parameters<typeof requireCurrentTrustedIdentity>[0] &
  IntroductionRepositoryClient & {
    from(table: 'audit_events'): {
      insert(
        payload: ReturnType<typeof captureIntroductionOutcome>['event'],
      ): Promise<{ error: Error | null }>;
    };
  };

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function getServerActionClient(): IntroductionOutcomeActionClient {
  return createClient() as unknown as IntroductionOutcomeActionClient;
}

function canMutateIntroduction(
  identity: Awaited<ReturnType<typeof requireCurrentTrustedIdentity>>,
  introduction: NonNullable<Awaited<ReturnType<typeof getIntroductionById>>>,
): boolean {
  return (
    hasStewardOrAdminRole(identity) ||
    introduction.requesterIdentityId === identity.id ||
    introduction.helperIdentityId === identity.id ||
    introduction.createdByIdentityId === identity.id
  );
}

export async function captureIntroductionOutcomeAction(
  introductionId: string,
  formData: FormData,
  options: { supabase?: IntroductionOutcomeActionClient; now?: Date } = {},
): Promise<IntroductionOutcomeActionResult> {
  const supabase = options.supabase ?? getServerActionClient();
  let identity: Awaited<ReturnType<typeof requireCurrentTrustedIdentity>>;

  try {
    identity = await requireCurrentTrustedIdentity(supabase);
  } catch (error) {
    return toSafeAuthFailureResult(error);
  }

  const introduction = await getIntroductionById(introductionId, supabase);

  if (!introduction) {
    return { ok: false, error: 'not_found', message: 'Introduction was not found.' };
  }

  if (!canMutateIntroduction(identity, introduction)) {
    return {
      ok: false,
      error: 'forbidden',
      message: 'You are not authorized to perform this action.',
    };
  }

  const rawOutcome = formValue(formData, 'outcome');

  if (!isIntroductionOutcome(rawOutcome)) {
    return { ok: false, error: 'validation', message: 'Choose a valid introduction outcome.' };
  }

  try {
    const result = captureIntroductionOutcome({
      introductionId,
      outcome: rawOutcome as IntroductionOutcome,
      reporterIdentityId: identity.id,
      note: formValue(formData, 'note'),
      occurredAt: options.now,
    });

    const { error } = await supabase.from('audit_events').insert(result.event);

    if (error) {
      throw error;
    }

    return { ok: true, outcome: result.outcome };
  } catch (error) {
    return {
      ok: false,
      error: 'validation',
      message: error instanceof Error ? error.message : 'Unable to capture introduction outcome.',
    };
  }
}
