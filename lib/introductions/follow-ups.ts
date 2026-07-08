import type { Json } from '@/types/supabase';

export const INTRODUCTION_FOLLOW_UP_STATUS_VALUES = ['scheduled', 'completed', 'skipped'] as const;
export type IntroductionFollowUpStatus = (typeof INTRODUCTION_FOLLOW_UP_STATUS_VALUES)[number];

export const INTRODUCTION_FOLLOW_UP_EVENT_TYPES = [
  'introduction_follow_up.created',
  'introduction_follow_up.completed',
  'introduction_follow_up.skipped',
] as const;
export type IntroductionFollowUpEventType = (typeof INTRODUCTION_FOLLOW_UP_EVENT_TYPES)[number];

export interface IntroductionFollowUpInput {
  introductionId: string;
  createdByIdentityId: string;
  dueAt: Date | string;
  note?: string | null;
  now?: Date | string;
}

export interface IntroductionFollowUp {
  id?: string;
  introductionId: string;
  createdByIdentityId: string;
  dueAt: string;
  status: IntroductionFollowUpStatus;
  note: string | null;
  createdAt: string;
  completedAt: string | null;
  skippedAt: string | null;
}

export type IntroductionFollowUpEventPayload = {
  event_type: IntroductionFollowUpEventType;
  actor_identity_id: string;
  subject_table: 'introduction_follow_ups';
  subject_id: string;
  metadata: Record<string, Json>;
  occurred_at: string;
};

const MAX_NOTE_LENGTH = 500;

function assertNonEmpty(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function normalizeTimestamp(value: Date | string, fieldName: string): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return date.toISOString();
}

function normalizeOptionalTimestamp(value?: Date | string): string {
  return value ? normalizeTimestamp(value, 'Timestamp') : new Date().toISOString();
}

export function normalizeFollowUpNote(note?: string | null): string | null {
  const normalized = note?.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return null;
  }

  if (normalized.length > MAX_NOTE_LENGTH) {
    throw new Error(`Follow-up note must be ${MAX_NOTE_LENGTH} characters or fewer.`);
  }

  return normalized;
}

export function isIntroductionFollowUpStatus(value: string): value is IntroductionFollowUpStatus {
  return INTRODUCTION_FOLLOW_UP_STATUS_VALUES.includes(value as IntroductionFollowUpStatus);
}

export function createIntroductionFollowUp(input: IntroductionFollowUpInput): IntroductionFollowUp {
  return {
    introductionId: assertNonEmpty(input.introductionId, 'Introduction id'),
    createdByIdentityId: assertNonEmpty(input.createdByIdentityId, 'Creator identity id'),
    dueAt: normalizeTimestamp(input.dueAt, 'Due date'),
    status: 'scheduled',
    note: normalizeFollowUpNote(input.note),
    createdAt: normalizeOptionalTimestamp(input.now),
    completedAt: null,
    skippedAt: null,
  };
}

export function isFollowUpDue(
  followUp: Pick<IntroductionFollowUp, 'dueAt' | 'status'>,
  now: Date | string = new Date(),
): boolean {
  return (
    followUp.status === 'scheduled' && new Date(followUp.dueAt).getTime() <= new Date(now).getTime()
  );
}

export function markFollowUpCompleted(
  followUp: IntroductionFollowUp,
  actorIdentityId: string,
  now: Date | string = new Date(),
): IntroductionFollowUp {
  assertNonEmpty(actorIdentityId, 'Actor identity id');

  if (followUp.status !== 'scheduled') {
    throw new Error('Only scheduled follow-ups can be completed.');
  }

  return { ...followUp, status: 'completed', completedAt: normalizeOptionalTimestamp(now) };
}

export function markFollowUpSkipped(
  followUp: IntroductionFollowUp,
  actorIdentityId: string,
  now: Date | string = new Date(),
): IntroductionFollowUp {
  assertNonEmpty(actorIdentityId, 'Actor identity id');

  if (followUp.status !== 'scheduled') {
    throw new Error('Only scheduled follow-ups can be skipped.');
  }

  return { ...followUp, status: 'skipped', skippedAt: normalizeOptionalTimestamp(now) };
}

export function buildFollowUpAuditEvent(input: {
  eventType: IntroductionFollowUpEventType;
  actorIdentityId: string;
  followUpId: string;
  introductionId: string;
  status: IntroductionFollowUpStatus;
  occurredAt: Date | string;
}): IntroductionFollowUpEventPayload {
  return {
    event_type: input.eventType,
    actor_identity_id: assertNonEmpty(input.actorIdentityId, 'Actor identity id'),
    subject_table: 'introduction_follow_ups',
    subject_id: assertNonEmpty(input.followUpId, 'Follow-up id'),
    occurred_at: normalizeTimestamp(input.occurredAt, 'Occurred at'),
    metadata: {
      introductionId: assertNonEmpty(input.introductionId, 'Introduction id'),
      status: input.status,
    },
  };
}
