import type { Json } from '@/types/supabase';

export const INTRODUCTION_FOLLOW_UP_REMINDER_STATUSES = [
  'scheduled',
  'sent',
  'completed',
  'canceled',
] as const;

export type IntroductionFollowUpReminderStatus =
  (typeof INTRODUCTION_FOLLOW_UP_REMINDER_STATUSES)[number];

export const INTRODUCTION_FOLLOW_UP_REMINDER_EVENT_TYPES = [
  'introduction_follow_up_reminder.scheduled',
  'introduction_follow_up_reminder.sent',
  'introduction_follow_up_reminder.completed',
  'introduction_follow_up_reminder.canceled',
] as const;

export type IntroductionFollowUpReminderEventType =
  (typeof INTRODUCTION_FOLLOW_UP_REMINDER_EVENT_TYPES)[number];

export interface ScheduleIntroductionFollowUpReminderInput {
  introductionId: string;
  stewardIdentityId: string;
  remindAt: Date | string;
  recipientIdentityIds: string[];
  note?: string | null;
  createdAt?: Date | string;
}

export interface IntroductionFollowUpReminder {
  introductionId: string;
  stewardIdentityId: string;
  remindAt: string;
  recipientIdentityIds: string[];
  note: string | null;
  status: IntroductionFollowUpReminderStatus;
  createdAt: string;
}

export type IntroductionFollowUpReminderEventPayload = {
  event_type: IntroductionFollowUpReminderEventType;
  actor_identity_id: string;
  subject_table: 'introductions';
  subject_id: string;
  metadata: Record<string, Json>;
  occurred_at: string;
};

export interface IntroductionFollowUpReminderResult {
  reminder: IntroductionFollowUpReminder;
  event: IntroductionFollowUpReminderEventPayload;
}

const MAX_NOTE_LENGTH = 500;

function assertNonEmpty(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function normalizeDate(value: Date | string, fieldName: string): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return date.toISOString();
}

function normalizeOptionalDate(value?: Date | string): string {
  return value ? normalizeDate(value, 'Created at') : new Date().toISOString();
}

export function normalizeFollowUpReminderNote(note?: string | null): string | null {
  const normalized = note?.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return null;
  }

  if (normalized.length > MAX_NOTE_LENGTH) {
    throw new Error(`Reminder note must be ${MAX_NOTE_LENGTH} characters or fewer.`);
  }

  return normalized;
}

export function normalizeFollowUpReminderRecipients(recipientIdentityIds: string[]): string[] {
  const normalized = [...new Set(recipientIdentityIds.map((id) => id.trim()).filter(Boolean))];

  if (normalized.length === 0) {
    throw new Error('At least one reminder recipient is required.');
  }

  return normalized;
}

export function scheduleIntroductionFollowUpReminder(
  input: ScheduleIntroductionFollowUpReminderInput,
): IntroductionFollowUpReminderResult {
  const introductionId = assertNonEmpty(input.introductionId, 'Introduction id');
  const stewardIdentityId = assertNonEmpty(input.stewardIdentityId, 'Steward identity id');
  const remindAt = normalizeDate(input.remindAt, 'Reminder time');
  const createdAt = normalizeOptionalDate(input.createdAt);
  const recipientIdentityIds = normalizeFollowUpReminderRecipients(input.recipientIdentityIds);
  const note = normalizeFollowUpReminderNote(input.note);

  if (new Date(remindAt).getTime() <= new Date(createdAt).getTime()) {
    throw new Error('Reminder time must be in the future.');
  }

  return {
    reminder: {
      introductionId,
      stewardIdentityId,
      remindAt,
      recipientIdentityIds,
      note,
      status: 'scheduled',
      createdAt,
    },
    event: {
      event_type: 'introduction_follow_up_reminder.scheduled',
      actor_identity_id: stewardIdentityId,
      subject_table: 'introductions',
      subject_id: introductionId,
      occurred_at: createdAt,
      metadata: {
        remindAt,
        recipientIdentityIds,
        recipientCount: recipientIdentityIds.length,
        hasNote: note !== null,
        noteLength: note?.length ?? 0,
        status: 'scheduled',
      },
    },
  };
}
