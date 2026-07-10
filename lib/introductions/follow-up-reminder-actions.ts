'use server';

import {
  hasStewardOrAdminRole,
  requireCurrentTrustedIdentity,
  toSafeAuthFailureResult,
} from '@/lib/auth/steward';
import {
  createFollowUpReminder,
  type FollowUpRepositoryClient,
} from '@/lib/introductions/follow-up-repository';
import { scheduleIntroductionFollowUpReminder } from '@/lib/introductions/follow-up-reminders';
import {
  getIntroductionById,
  type IntroductionRepositoryClient,
} from '@/lib/introductions/repository';
import { createClient } from '@/lib/supabase/server';

export type IntroductionFollowUpReminderActionResult =
  | { ok: true; reminder: ReturnType<typeof scheduleIntroductionFollowUpReminder>['reminder'] }
  | { ok: false; error: 'validation' | 'not_found'; message: string }
  | { ok: false; error: 'auth_required' | 'forbidden'; message: string };

type AuditEventInsert = {
  actor_identity_id: string;
  event_type: string;
  subject_table: string;
  subject_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type IntroductionFollowUpReminderActionClient = Parameters<
  typeof requireCurrentTrustedIdentity
>[0] &
  IntroductionRepositoryClient &
  FollowUpRepositoryClient & {
    from(table: 'audit_events'): {
      insert(payload: AuditEventInsert): Promise<{ error: Error | null }>;
    };
  };

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function formValues(formData: FormData, key: string): string[] {
  const directValues = formData.getAll(key).filter((value): value is string => typeof value === 'string');
  return directValues.flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean);
}

function getServerActionClient(): IntroductionFollowUpReminderActionClient {
  return createClient() as unknown as IntroductionFollowUpReminderActionClient;
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

export async function scheduleIntroductionFollowUpReminderAction(
  introductionId: string,
  formData: FormData,
  options: { supabase?: IntroductionFollowUpReminderActionClient; now?: Date } = {},
): Promise<IntroductionFollowUpReminderActionResult> {
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

  try {
    const result = scheduleIntroductionFollowUpReminder({
      introductionId,
      stewardIdentityId: identity.id,
      remindAt: formValue(formData, 'remindAt'),
      recipientIdentityIds: formValues(formData, 'recipientIdentityIds'),
      note: formValue(formData, 'note'),
      createdAt: options.now,
    });

    await createFollowUpReminder(result.reminder, supabase);

    const { occurred_at: createdAt, ...event } = result.event;
    const { error } = await supabase.from('audit_events').insert({
      ...event,
      created_at: createdAt,
    });

    if (error) throw error;

    return { ok: true, reminder: result.reminder };
  } catch (error) {
    return {
      ok: false,
      error: 'validation',
      message: error instanceof Error ? error.message : 'Unable to schedule follow-up reminder.',
    };
  }
}
