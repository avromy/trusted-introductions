'use server';

import { revalidatePath } from 'next/cache';

import { hasStewardOrAdminRole, requireCurrentTrustedIdentity, toSafeAuthFailureResult } from '@/lib/auth/steward';
import { createClient } from '@/lib/supabase/server';
import {
  canRecordIntroductionOutcome,
  isIntroductionOutcomeStatus,
  planIntroductionOutcome,
  type IntroductionForOutcome,
  type IntroductionOutcomeStatus,
  type SafeIntroductionOutcome,
} from './outcomes';

type MutationResult<T = unknown> = Promise<{ data: T; error: Error | null }>;

type IntroductionOutcomeActionClient = Parameters<typeof requireCurrentTrustedIdentity>[0] & {
  from(table: 'introductions'): {
    select(columns: string): {
      eq(column: 'id', value: string): { maybeSingle(): MutationResult<IntroductionForOutcome | null> };
    };
    update(payload: Record<string, unknown>): {
      eq(column: 'id', value: string): MutationResult<null>;
    };
  };
  from(table: 'introduction_outcomes' | 'audit_events' | 'follow_up_reminders'): {
    insert(payload: Record<string, unknown>): MutationResult<null>;
  };
};

export type RecordIntroductionOutcomeActionResult =
  | { ok: true; outcome: SafeIntroductionOutcome }
  | { ok: false; error: 'invalid' | 'auth_required' | 'forbidden' | 'not_found'; message: string };

function readFormString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function recordIntroductionOutcomeAction(
  introductionId: string,
  formData: FormData,
): Promise<RecordIntroductionOutcomeActionResult> {
  const trimmedIntroductionId = introductionId.trim();
  const outcomeStatus = readFormString(formData, 'outcomeStatus');

  if (!trimmedIntroductionId) {
    return { ok: false, error: 'invalid', message: 'Introduction id is required.' };
  }

  if (!isIntroductionOutcomeStatus(outcomeStatus)) {
    return { ok: false, error: 'invalid', message: 'Choose a valid outcome status.' };
  }

  const supabase = createClient() as unknown as IntroductionOutcomeActionClient;
  let actor;

  try {
    actor = await requireCurrentTrustedIdentity(supabase);
  } catch (error) {
    return toSafeAuthFailureResult(error);
  }

  const introductionResult = await supabase
    .from('introductions')
    .select('id, requester_identity_id, helper_identity_id, steward_identity_id, status, community_id')
    .eq('id', trimmedIntroductionId)
    .maybeSingle();

  if (introductionResult.error) {
    throw introductionResult.error;
  }

  if (!introductionResult.data) {
    return { ok: false, error: 'not_found', message: 'Introduction was not found.' };
  }

  const introduction = introductionResult.data;
  const isSteward = hasStewardOrAdminRole(actor, introduction.community_id);

  if (!canRecordIntroductionOutcome(introduction, actor.id, isSteward)) {
    return {
      ok: false,
      error: 'forbidden',
      message: 'You are not authorized to record an outcome for this introduction.',
    };
  }

  const plan = planIntroductionOutcome({
    introduction,
    actorIdentityId: actor.id,
    outcomeStatus: outcomeStatus as IntroductionOutcomeStatus,
    notes: readFormString(formData, 'notes'),
    followUpAt: readFormString(formData, 'followUpAt'),
  });

  const outcomeInsert = await supabase.from('introduction_outcomes').insert(plan.outcome);
  if (outcomeInsert.error) {
    throw outcomeInsert.error;
  }

  const introductionUpdate = await supabase
    .from('introductions')
    .update(plan.introductionUpdate)
    .eq('id', introduction.id);
  if (introductionUpdate.error) {
    throw introductionUpdate.error;
  }

  if (plan.followUpReminder) {
    const reminderInsert = await supabase.from('follow_up_reminders').insert(plan.followUpReminder);
    if (reminderInsert.error) {
      throw reminderInsert.error;
    }
  }

  const auditInsert = await supabase.from('audit_events').insert(plan.auditEvent);
  if (auditInsert.error) {
    throw auditInsert.error;
  }

  revalidatePath(`/introductions/${introduction.id}/outcome`);

  return { ok: true, outcome: plan.safeOutcome };
}
