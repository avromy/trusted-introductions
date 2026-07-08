import type { Json } from '@/types/supabase';

export const STEWARD_REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'needs_info'] as const;

export type StewardReviewStatus = (typeof STEWARD_REVIEW_STATUSES)[number];

export const FINAL_STEWARD_REVIEW_STATUSES = ['approved', 'rejected'] as const satisfies readonly StewardReviewStatus[];

export type FinalStewardReviewStatus = (typeof FINAL_STEWARD_REVIEW_STATUSES)[number];

export const STEWARD_REVIEW_EVENT_TYPES = [
  'steward_review.approved',
  'steward_review.rejected',
  'steward_review.needs_info',
] as const;

export type StewardReviewEventType = (typeof STEWARD_REVIEW_EVENT_TYPES)[number];

export interface StewardReview {
  id: string;
  requestId: string;
  stewardIdentityId: string;
  subjectIdentityId: string;
  status: StewardReviewStatus;
  decidedAt: string | null;
  decisionReason: string | null;
}

export interface StewardReviewDecisionInput {
  review: Pick<
    StewardReview,
    'id' | 'requestId' | 'stewardIdentityId' | 'subjectIdentityId' | 'status'
  >;
  stewardIdentityId: string;
  reason?: string | null;
  decidedAt?: Date | string;
}

export type StewardReviewEventPayload = {
  event_type: StewardReviewEventType;
  actor_identity_id: string;
  subject_table: 'steward_reviews';
  subject_id: string;
  metadata: Record<string, Json>;
  occurred_at: string;
};

export interface StewardReviewDecisionResult {
  review: StewardReview;
  event: StewardReviewEventPayload;
}

const REVIEWABLE_STATUSES = ['pending', 'needs_info'] as const satisfies readonly StewardReviewStatus[];

function assertNonEmpty(value: string, fieldName: string): void {
  if (!value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }
}

function normalizeOccurredAt(value?: Date | string): string {
  return value instanceof Date ? value.toISOString() : (value ?? new Date().toISOString());
}

function normalizeReason(reason?: string | null): string | null {
  const normalized = reason?.trim();
  return normalized ? normalized : null;
}

export function isStewardReviewStatus(status: string): status is StewardReviewStatus {
  return STEWARD_REVIEW_STATUSES.includes(status as StewardReviewStatus);
}

export function isFinalStewardReviewStatus(
  status: StewardReviewStatus,
): status is FinalStewardReviewStatus {
  return FINAL_STEWARD_REVIEW_STATUSES.includes(status as FinalStewardReviewStatus);
}

export function assertReviewCanBeDecided(status: StewardReviewStatus): void {
  if (!REVIEWABLE_STATUSES.includes(status as (typeof REVIEWABLE_STATUSES)[number])) {
    throw new Error(`Steward review with status "${status}" cannot be changed.`);
  }
}

function createSafeStewardReviewEventPayload(input: {
  eventType: StewardReviewEventType;
  review: Pick<StewardReview, 'id' | 'requestId' | 'stewardIdentityId' | 'subjectIdentityId' | 'status'>;
  nextStatus: StewardReviewStatus;
  actorIdentityId: string;
  reason: string | null;
  occurredAt: string;
}): StewardReviewEventPayload {
  return {
    event_type: input.eventType,
    actor_identity_id: input.actorIdentityId,
    subject_table: 'steward_reviews',
    subject_id: input.review.id,
    occurred_at: input.occurredAt,
    metadata: {
      requestId: input.review.requestId,
      subjectIdentityId: input.review.subjectIdentityId,
      previousStatus: input.review.status,
      status: input.nextStatus,
      hasReason: input.reason !== null,
      reasonLength: input.reason?.length ?? 0,
    },
  };
}

function decideStewardReview(
  input: StewardReviewDecisionInput,
  nextStatus: Exclude<StewardReviewStatus, 'pending'>,
): StewardReviewDecisionResult {
  assertNonEmpty(input.review.id, 'Steward review id');
  assertNonEmpty(input.review.requestId, 'Steward review request id');
  assertNonEmpty(input.review.stewardIdentityId, 'Assigned steward identity id');
  assertNonEmpty(input.review.subjectIdentityId, 'Review subject identity id');
  assertNonEmpty(input.stewardIdentityId, 'Reviewing steward identity id');

  if (input.stewardIdentityId !== input.review.stewardIdentityId) {
    throw new Error('Only the assigned steward can decide this review.');
  }

  assertReviewCanBeDecided(input.review.status);

  const decidedAt = normalizeOccurredAt(input.decidedAt);
  const decisionReason = normalizeReason(input.reason);
  const review: StewardReview = {
    ...input.review,
    status: nextStatus,
    decidedAt,
    decisionReason,
  };

  return {
    review,
    event: createSafeStewardReviewEventPayload({
      eventType: `steward_review.${nextStatus}` as StewardReviewEventType,
      review: input.review,
      nextStatus,
      actorIdentityId: input.stewardIdentityId,
      reason: decisionReason,
      occurredAt: decidedAt,
    }),
  };
}

export function approveStewardReview(input: StewardReviewDecisionInput): StewardReviewDecisionResult {
  return decideStewardReview(input, 'approved');
}

export function rejectStewardReview(input: StewardReviewDecisionInput): StewardReviewDecisionResult {
  return decideStewardReview(input, 'rejected');
}

export function requestStewardReviewInfo(
  input: StewardReviewDecisionInput,
): StewardReviewDecisionResult {
  return decideStewardReview(input, 'needs_info');
}
