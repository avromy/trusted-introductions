'use server';

import { createAuditEventPayload } from '@/lib/audit';
import { insertAuditEvent, type AuditEventsSupabaseClient } from '@/lib/audit/server';
import {
  createIntroductionFollowUp,
  markIntroductionFollowUpReminderSent,
  validateIntroductionFollowUpInput,
  type IntroductionFollowUp,
  type IntroductionFollowUpInput,
} from '@/lib/introductions/follow-ups';
import { createClient } from '@/lib/supabase/server';

export type ScheduleIntroductionFollowUpActionInput = IntroductionFollowUpInput;

export type ScheduleIntroductionFollowUpActionResult =
  | { ok: true; followUp: IntroductionFollowUp }
  | { ok: false; error: 'validation'; errors: Record<string, string[]> };

export type IntroductionFollowUpActionClient = AuditEventsSupabaseClient;

function getServerActionClient(): IntroductionFollowUpActionClient {
  return createClient() as unknown as IntroductionFollowUpActionClient;
}

export async function scheduleIntroductionFollowUpAction(
  input: ScheduleIntroductionFollowUpActionInput,
  options: { supabase?: IntroductionFollowUpActionClient; id?: string; now?: Date } = {},
): Promise<ScheduleIntroductionFollowUpActionResult> {
  const validation = validateIntroductionFollowUpInput(input);

  if (!validation.valid) {
    return { ok: false, error: 'validation', errors: validation.errors };
  }

  const supabase = options.supabase ?? getServerActionClient();
  const followUp = createIntroductionFollowUp(input, { id: options.id, now: options.now });

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'introduction_follow_up.scheduled',
      actor: { type: 'user', id: followUp.stewardIdentityId },
      target: { type: 'introduction_follow_up', id: followUp.id },
      metadata: {
        introductionId: followUp.introductionId,
        requesterIdentityId: followUp.requesterIdentityId,
        helperIdentityId: followUp.helperIdentityId,
        dueAt: followUp.dueAt,
      },
      occurredAt: options.now,
    }),
  );

  return { ok: true, followUp };
}

export async function markIntroductionFollowUpReminderSentAction(
  followUp: IntroductionFollowUp,
  options: { supabase?: IntroductionFollowUpActionClient; sentAt?: Date } = {},
): Promise<{ ok: true; followUp: IntroductionFollowUp }> {
  const supabase = options.supabase ?? getServerActionClient();
  const sentFollowUp = markIntroductionFollowUpReminderSent(followUp, options.sentAt);

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'introduction_follow_up.reminder_sent',
      actor: { type: 'user', id: sentFollowUp.stewardIdentityId },
      target: { type: 'introduction_follow_up', id: sentFollowUp.id },
      metadata: {
        introductionId: sentFollowUp.introductionId,
        dueAt: sentFollowUp.dueAt,
      },
      occurredAt: options.sentAt,
    }),
  );

  return { ok: true, followUp: sentFollowUp };
}
