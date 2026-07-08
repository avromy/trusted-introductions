'use server';

import { createAuditEventPayload } from '@/lib/audit';
import { insertAuditEvent, type AuditEventsSupabaseClient } from '@/lib/audit/server';
import { requireStewardOrAdmin, toSafeAuthFailureResult } from '@/lib/auth/steward';
import {
  createStewardReview,
  getStewardReviewById,
  updateStewardReviewDecision,
  type StewardReviewRepositoryClient,
} from '@/lib/matching/steward-review-repository';
import {
  approveStewardReview,
  rejectStewardReview,
  requestStewardReviewInfo,
  type StewardReviewDecisionInput,
} from '@/lib/matching/steward-review';
import { createClient } from '@/lib/supabase/server';
import type { StewardReview, StewardReviewInput, StewardReviewStatus } from '@/types/matching';

export type StewardReviewActionResult =
  | { ok: true; review: StewardReview }
  | { ok: false; error: 'auth_required' | 'forbidden'; message: string }
  | { ok: false; error: 'not_found' | 'invalid_decision'; message: string };

export type StewardReviewActionClient = StewardReviewRepositoryClient &
  AuditEventsSupabaseClient &
  Parameters<typeof requireStewardOrAdmin>[0];

function getServerActionClient(): StewardReviewActionClient {
  return createClient() as unknown as StewardReviewActionClient;
}

function toDecisionInput(review: StewardReview, stewardIdentityId: string, decisionReason?: string | null): StewardReviewDecisionInput {
  return {
    review,
    stewardIdentityId,
    reason: decisionReason,
  };
}

export async function createStewardReviewAction(
  input: StewardReviewInput,
  options: { supabase?: StewardReviewActionClient; now?: Date } = {},
): Promise<StewardReviewActionResult> {
  const supabase = options.supabase ?? getServerActionClient();
  let identity: Awaited<ReturnType<typeof requireStewardOrAdmin>>;

  try {
    identity = await requireStewardOrAdmin(supabase);
  } catch (error) {
    return toSafeAuthFailureResult(error);
  }

  const review = await createStewardReview({ ...input, stewardIdentityId: input.stewardIdentityId || identity.id }, supabase);

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'steward_review.created',
      actor: { type: 'user', id: identity.id },
      target: { type: 'steward_review', id: review.id },
      metadata: {
        requestId: review.requestId,
        subjectIdentityId: review.subjectIdentityId,
        matchSuggestionId: review.matchSuggestionId ?? null,
        status: review.status,
      },
      occurredAt: options.now,
    }),
  );

  return { ok: true, review };
}

export async function decideStewardReviewAction(
  reviewId: string,
  decision: Exclude<StewardReviewStatus, 'pending'>,
  options: { supabase?: StewardReviewActionClient; now?: Date; decisionReason?: string | null } = {},
): Promise<StewardReviewActionResult> {
  const supabase = options.supabase ?? getServerActionClient();
  let identity: Awaited<ReturnType<typeof requireStewardOrAdmin>>;

  try {
    identity = await requireStewardOrAdmin(supabase);
  } catch (error) {
    return toSafeAuthFailureResult(error);
  }

  const review = await getStewardReviewById(reviewId, supabase);

  if (!review) {
    return { ok: false, error: 'not_found', message: 'Steward review was not found.' };
  }

  let decided: ReturnType<typeof approveStewardReview>;

  try {
    if (decision === 'approved') {
      decided = approveStewardReview(toDecisionInput(review, identity.id, options.decisionReason));
    } else if (decision === 'rejected') {
      decided = rejectStewardReview(toDecisionInput(review, identity.id, options.decisionReason));
    } else {
      decided = requestStewardReviewInfo(toDecisionInput(review, identity.id, options.decisionReason));
    }
  } catch (error) {
    return { ok: false, error: 'invalid_decision', message: error instanceof Error ? error.message : 'Invalid steward review decision.' };
  }

  const updated = await updateStewardReviewDecision(decided.review, options.now ?? new Date(), supabase);

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: decided.event.event_type,
      actor: { type: 'user', id: identity.id },
      target: { type: 'steward_review', id: updated.id },
      metadata: decided.event.metadata,
      occurredAt: options.now,
    }),
  );

  return { ok: true, review: updated };
}
