'use server';

import { requireCurrentTrustedIdentity, toSafeAuthFailureResult } from '@/lib/auth/steward';
import { scheduleIntroductionFollowUpReminder } from '@/lib/introductions/follow-up-reminders';
import { createClient } from '@/lib/supabase/server';

export type IntroductionFollowUpReminderActionResult =
  | { ok: true; reminder: ReturnType<typeof scheduleIntroductionFollowUpReminder>['reminder'] }
  | { ok: false; error: 'validation'; message: string }
  | { ok: false; error: 'auth_required' | 'forbidden'; message: string };

export type IntroductionFollowUpReminderActionClient = Parameters<typeof requireCurrentTrustedIdentity>[0] & {
  from(table: 'audit_events'): {
    insert(payload: ReturnType<typeof scheduleIntroductionFollowUpReminder>['event']): Promise<{ error: Error | null }>;
  };
};

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function formValues(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((value): value is string => typeof value === 'string');
}

function getServerActionClient(): IntroductionFollowUpReminderActionClient {
  return createClient() as unknown as IntroductionFollowUpReminderActionClient;
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

  try {
    const result = scheduleIntroductionFollowUpReminder({
      introductionId,
      stewardIdentityId: identity.id,
      remindAt: formValue(formData, 'remindAt'),
      recipientIdentityIds: formValues(formData, 'recipientIdentityIds'),
      note: formValue(formData, 'note'),
      createdAt: options.now,
    });

    const { error } = await supabase.from('audit_events').insert(result.event);

    if (error) {
      throw error;
    }

    return { ok: true, reminder: result.reminder };
  } catch (error) {
    return {
      ok: false,
      error: 'validation',
      message: error instanceof Error ? error.message : 'Unable to schedule follow-up reminder.',
    };
  }
}
