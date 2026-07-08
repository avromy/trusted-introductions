import type { Json } from '@/types/supabase';

export const INTRODUCTION_OUTCOME_VALUES = [
  'connected',
  'meeting_scheduled',
  'in_conversation',
  'opportunity_created',
  'not_a_fit',
  'no_response',
] as const;

export type IntroductionOutcome = (typeof INTRODUCTION_OUTCOME_VALUES)[number];

export const INTRODUCTION_OUTCOME_EVENT_TYPES = [
  'introduction_outcome.connected',
  'introduction_outcome.meeting_scheduled',
  'introduction_outcome.in_conversation',
  'introduction_outcome.opportunity_created',
  'introduction_outcome.not_a_fit',
  'introduction_outcome.no_response',
] as const;

export type IntroductionOutcomeEventType = (typeof INTRODUCTION_OUTCOME_EVENT_TYPES)[number];

export interface IntroductionOutcomeCaptureInput {
  introductionId: string;
  outcome: IntroductionOutcome;
  reporterIdentityId: string;
  note?: string | null;
  occurredAt?: Date | string;
}

export interface CapturedIntroductionOutcome {
  introductionId: string;
  outcome: IntroductionOutcome;
  reporterIdentityId: string;
  note: string | null;
  capturedAt: string;
}

export type IntroductionOutcomeEventPayload = {
  event_type: IntroductionOutcomeEventType;
  actor_identity_id: string;
  subject_table: 'introductions';
  subject_id: string;
  metadata: Record<string, Json>;
  occurred_at: string;
};

export interface IntroductionOutcomeCaptureResult {
  outcome: CapturedIntroductionOutcome;
  event: IntroductionOutcomeEventPayload;
}

const MAX_NOTE_LENGTH = 500;

function assertNonEmpty(value: string, fieldName: string): void {
  if (!value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }
}

function normalizeOccurredAt(value?: Date | string): string {
  return value instanceof Date ? value.toISOString() : (value ?? new Date().toISOString());
}

export function isIntroductionOutcome(value: string): value is IntroductionOutcome {
  return INTRODUCTION_OUTCOME_VALUES.includes(value as IntroductionOutcome);
}

export function normalizeIntroductionOutcomeNote(note?: string | null): string | null {
  const normalized = note?.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return null;
  }

  if (normalized.length > MAX_NOTE_LENGTH) {
    throw new Error(`Outcome note must be ${MAX_NOTE_LENGTH} characters or fewer.`);
  }

  return normalized;
}

export function captureIntroductionOutcome(
  input: IntroductionOutcomeCaptureInput,
): IntroductionOutcomeCaptureResult {
  assertNonEmpty(input.introductionId, 'Introduction id');
  assertNonEmpty(input.reporterIdentityId, 'Reporter identity id');

  if (!isIntroductionOutcome(input.outcome)) {
    throw new Error(`Unsupported introduction outcome "${input.outcome}".`);
  }

  const capturedAt = normalizeOccurredAt(input.occurredAt);
  const note = normalizeIntroductionOutcomeNote(input.note);
  const outcome: CapturedIntroductionOutcome = {
    introductionId: input.introductionId.trim(),
    outcome: input.outcome,
    reporterIdentityId: input.reporterIdentityId.trim(),
    note,
    capturedAt,
  };

  return {
    outcome,
    event: {
      event_type: `introduction_outcome.${input.outcome}` as IntroductionOutcomeEventType,
      actor_identity_id: outcome.reporterIdentityId,
      subject_table: 'introductions',
      subject_id: outcome.introductionId,
      occurred_at: capturedAt,
      metadata: {
        outcome: input.outcome,
        hasNote: note !== null,
        noteLength: note?.length ?? 0,
      },
    },
  };
}
