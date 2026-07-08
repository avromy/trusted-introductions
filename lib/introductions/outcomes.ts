import type { Json } from '@/types/supabase';

export const INTRODUCTION_OUTCOME_STATUSES = [
  'completed',
  'declined',
  'unresponsive',
  'follow_up_needed',
] as const;

export type IntroductionOutcomeStatus = (typeof INTRODUCTION_OUTCOME_STATUSES)[number];

export const INTRODUCTION_OUTCOME_EVENT_TYPE = 'introduction_outcome.recorded' as const;

export type IntroductionStatus =
  | 'pending'
  | 'accepted'
  | 'active'
  | 'completed'
  | 'declined'
  | 'unresponsive'
  | 'follow_up_needed';

export type IntroductionForOutcome = {
  id: string;
  requester_identity_id: string;
  helper_identity_id: string;
  steward_identity_id: string | null;
  status: IntroductionStatus | string;
  community_id?: string | null;
};

export type RecordIntroductionOutcomeInput = {
  introduction: IntroductionForOutcome;
  actorIdentityId: string;
  outcomeStatus: IntroductionOutcomeStatus;
  notes?: string | null;
  followUpAt?: Date | string | null;
  occurredAt?: Date | string;
};

export type IntroductionOutcomeInsertPayload = {
  introduction_id: string;
  outcome_status: IntroductionOutcomeStatus;
  recorded_by_identity_id: string;
  notes: string | null;
  created_at: string;
};

export type IntroductionUpdatePayload = {
  status: IntroductionStatus;
  outcome_status: IntroductionOutcomeStatus;
  outcome_recorded_at: string;
  updated_at: string;
};

export type IntroductionOutcomeAuditPayload = {
  event_type: typeof INTRODUCTION_OUTCOME_EVENT_TYPE;
  actor_identity_id: string;
  subject_table: 'introductions';
  subject_id: string;
  metadata: Record<string, Json>;
  occurred_at: string;
};

export type FollowUpReminderInsertPayload = {
  introduction_id: string;
  requester_identity_id: string;
  helper_identity_id: string;
  created_by_identity_id: string;
  remind_at: string;
  status: 'pending';
  context: string;
};

export type SafeIntroductionOutcome = {
  introductionId: string;
  outcomeStatus: IntroductionOutcomeStatus;
  recordedByIdentityId: string;
  hasNotes: boolean;
  notesLength: number;
  followUpReminder: boolean;
};

export type IntroductionOutcomePlan = {
  outcome: IntroductionOutcomeInsertPayload;
  introductionUpdate: IntroductionUpdatePayload;
  auditEvent: IntroductionOutcomeAuditPayload;
  followUpReminder: FollowUpReminderInsertPayload | null;
  safeOutcome: SafeIntroductionOutcome;
};

const MAX_NOTES_LENGTH = 1000;
const NOTE_ALLOWED_STATUSES = new Set<IntroductionOutcomeStatus>([
  'completed',
  'declined',
  'follow_up_needed',
]);

function assertNonEmpty(value: string, fieldName: string): void {
  if (!value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }
}

function normalizeOccurredAt(value?: Date | string | null): string {
  return value instanceof Date ? value.toISOString() : (value ?? new Date().toISOString());
}

export function isIntroductionOutcomeStatus(value: unknown): value is IntroductionOutcomeStatus {
  return INTRODUCTION_OUTCOME_STATUSES.includes(value as IntroductionOutcomeStatus);
}

export function normalizeOutcomeNotes(
  notes: string | null | undefined,
  status: IntroductionOutcomeStatus,
): string | null {
  if (!NOTE_ALLOWED_STATUSES.has(status)) {
    return null;
  }

  const normalized = notes?.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

  return normalized ? normalized.slice(0, MAX_NOTES_LENGTH) : null;
}

export function statusForOutcome(status: IntroductionOutcomeStatus): IntroductionStatus {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'declined':
      return 'declined';
    case 'unresponsive':
      return 'unresponsive';
    case 'follow_up_needed':
      return 'follow_up_needed';
  }
}

export function canRecordIntroductionOutcome(
  introduction: IntroductionForOutcome,
  actorIdentityId: string,
  isStewardOrAdmin = false,
): boolean {
  return (
    introduction.requester_identity_id === actorIdentityId ||
    introduction.helper_identity_id === actorIdentityId ||
    introduction.steward_identity_id === actorIdentityId ||
    isStewardOrAdmin
  );
}

export function createFollowUpReminderPayload(input: {
  introduction: Pick<IntroductionForOutcome, 'id' | 'requester_identity_id' | 'helper_identity_id'>;
  actorIdentityId: string;
  followUpAt?: Date | string | null;
}): FollowUpReminderInsertPayload {
  const remindAt = normalizeOccurredAt(
    input.followUpAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  );

  return {
    introduction_id: input.introduction.id,
    requester_identity_id: input.introduction.requester_identity_id,
    helper_identity_id: input.introduction.helper_identity_id,
    created_by_identity_id: input.actorIdentityId,
    remind_at: remindAt,
    status: 'pending',
    context: 'introduction_outcome_follow_up',
  };
}

export function planIntroductionOutcome(
  input: RecordIntroductionOutcomeInput,
): IntroductionOutcomePlan {
  assertNonEmpty(input.introduction.id, 'Introduction id');
  assertNonEmpty(input.introduction.requester_identity_id, 'Requester identity id');
  assertNonEmpty(input.introduction.helper_identity_id, 'Helper identity id');
  assertNonEmpty(input.actorIdentityId, 'Actor identity id');

  const occurredAt = normalizeOccurredAt(input.occurredAt);
  const notes = normalizeOutcomeNotes(input.notes, input.outcomeStatus);
  const nextStatus = statusForOutcome(input.outcomeStatus);
  const followUpReminder =
    input.outcomeStatus === 'follow_up_needed'
      ? createFollowUpReminderPayload({
          introduction: input.introduction,
          actorIdentityId: input.actorIdentityId,
          followUpAt: input.followUpAt,
        })
      : null;

  return {
    outcome: {
      introduction_id: input.introduction.id,
      outcome_status: input.outcomeStatus,
      recorded_by_identity_id: input.actorIdentityId,
      notes,
      created_at: occurredAt,
    },
    introductionUpdate: {
      status: nextStatus,
      outcome_status: input.outcomeStatus,
      outcome_recorded_at: occurredAt,
      updated_at: occurredAt,
    },
    auditEvent: {
      event_type: INTRODUCTION_OUTCOME_EVENT_TYPE,
      actor_identity_id: input.actorIdentityId,
      subject_table: 'introductions',
      subject_id: input.introduction.id,
      occurred_at: occurredAt,
      metadata: {
        previousStatus: input.introduction.status,
        status: nextStatus,
        outcomeStatus: input.outcomeStatus,
        hasNotes: notes !== null,
        notesLength: notes?.length ?? 0,
        followUpReminder: followUpReminder !== null,
      },
    },
    followUpReminder,
    safeOutcome: {
      introductionId: input.introduction.id,
      outcomeStatus: input.outcomeStatus,
      recordedByIdentityId: input.actorIdentityId,
      hasNotes: notes !== null,
      notesLength: notes?.length ?? 0,
      followUpReminder: followUpReminder !== null,
    },
  };
}
