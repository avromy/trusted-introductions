import type { Json } from '@/types/supabase';

export const INTRODUCTION_STATUSES = ['drafted', 'sent', 'accepted', 'declined', 'closed'] as const;

export type IntroductionStatus = (typeof INTRODUCTION_STATUSES)[number];

export interface IntroductionCreationInput {
  requestId: string;
  matchSuggestionId: string;
  helperIdentityId: string;
  requesterIdentityId: string;
  stewardIdentityId: string;
  stewardReviewId: string;
  stewardReviewStatus: string;
  message?: string | null;
  createdAt?: Date | string;
}

export interface CreatedIntroduction {
  id?: string;
  requestId: string;
  matchSuggestionId: string;
  helperIdentityId: string;
  requesterIdentityId: string;
  stewardIdentityId: string;
  stewardReviewId: string;
  status: IntroductionStatus;
  message: string | null;
  createdAt: string;
}

export type IntroductionCreatedEventPayload = {
  event_type: 'introduction.created';
  actor_identity_id: string;
  subject_table: 'introductions';
  subject_id: string | null;
  metadata: Record<string, Json>;
  occurred_at: string;
};

export interface IntroductionCreationResult {
  introduction: CreatedIntroduction;
  event: IntroductionCreatedEventPayload;
}

const MAX_MESSAGE_LENGTH = 2_000;

function assertNonEmpty(value: string, fieldName: string): void {
  if (!value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }
}

function normalizeOccurredAt(value?: Date | string): string {
  return value instanceof Date ? value.toISOString() : (value ?? new Date().toISOString());
}

export function normalizeIntroductionMessage(message?: string | null): string | null {
  const normalized = message?.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return null;
  }

  if (normalized.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Introduction message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  }

  return normalized;
}

export function createIntroductionFromApprovedMatch(
  input: IntroductionCreationInput,
): IntroductionCreationResult {
  assertNonEmpty(input.requestId, 'Request id');
  assertNonEmpty(input.matchSuggestionId, 'Match suggestion id');
  assertNonEmpty(input.helperIdentityId, 'Helper identity id');
  assertNonEmpty(input.requesterIdentityId, 'Requester identity id');
  assertNonEmpty(input.stewardIdentityId, 'Steward identity id');
  assertNonEmpty(input.stewardReviewId, 'Steward review id');

  if (input.stewardReviewStatus !== 'approved') {
    throw new Error('Introduction can only be created from an approved steward review.');
  }

  if (input.helperIdentityId.trim() === input.requesterIdentityId.trim()) {
    throw new Error('Helper and requester must be different identities.');
  }

  const createdAt = normalizeOccurredAt(input.createdAt);
  const message = normalizeIntroductionMessage(input.message);
  const introduction: CreatedIntroduction = {
    requestId: input.requestId.trim(),
    matchSuggestionId: input.matchSuggestionId.trim(),
    helperIdentityId: input.helperIdentityId.trim(),
    requesterIdentityId: input.requesterIdentityId.trim(),
    stewardIdentityId: input.stewardIdentityId.trim(),
    stewardReviewId: input.stewardReviewId.trim(),
    status: 'drafted',
    message,
    createdAt,
  };

  return {
    introduction,
    event: {
      event_type: 'introduction.created',
      actor_identity_id: introduction.stewardIdentityId,
      subject_table: 'introductions',
      subject_id: null,
      occurred_at: createdAt,
      metadata: {
        requestId: introduction.requestId,
        matchSuggestionId: introduction.matchSuggestionId,
        helperIdentityId: introduction.helperIdentityId,
        requesterIdentityId: introduction.requesterIdentityId,
        stewardReviewId: introduction.stewardReviewId,
        status: introduction.status,
        hasMessage: message !== null,
        messageLength: message?.length ?? 0,
      },
    },
  };
}
