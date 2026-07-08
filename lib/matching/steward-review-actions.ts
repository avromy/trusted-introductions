'use server';

import { revalidatePath } from 'next/cache';

import { createAuditEventPayload } from '@/lib/audit';
import { insertAuditEvent, type AuditEventsSupabaseClient } from '@/lib/audit/server';
import { requireStewardOrAdmin, toSafeAuthFailureResult } from '@/lib/auth/steward';
import {
  approveStewardReview,
  rejectStewardReview,
  requestStewardReviewInfo,
  type StewardReview,
  type StewardReviewStatus,
} from '@/lib/matching/steward-review';
import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/supabase';

type StewardReviewRow = Database['public']['Tables']['steward_reviews']['Row'];

type StewardReviewSelectBuilder = {
  select(columns: string): StewardReviewSelectBuilder;
  eq(column: string, value: string): StewardReviewSelectBuilder;
  order(column: string, options?: { ascending?: boolean }): StewardReviewSelectBuilder;
  single(): Promise<{ data: StewardReviewRow | null; error: Error | null }>;
  then<TResult1 = { data: StewardReviewRow[] | null; error: Error | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: StewardReviewRow[] | null;
          error: Error | null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
};

type StewardReviewUpdateBuilder = {
  eq(column: string, value: string): StewardReviewUpdateBuilder;
  select(columns: string): StewardReviewUpdateBuilder;
  single(): Promise<{ data: StewardReviewRow | null; error: Error | null }>;
};

export type StewardReviewActionsClient = AuditEventsSupabaseClient &
  Parameters<typeof requireStewardOrAdmin>[0] & {
    from(table: 'steward_reviews'): {
      select(columns: string): StewardReviewSelectBuilder;
      update(values: Partial<StewardReviewRow>): StewardReviewUpdateBuilder;
    };
  };

export type StewardReviewActionIntent = 'approve' | 'reject' | 'needs_info';

export type StewardReviewActionResult =
  | { ok: true; review: StewardReview }
  | {
      ok: false;
      error: 'validation' | 'not_found' | 'persistence' | 'auth_required' | 'forbidden';
      message: string;
    };

export type StewardReviewMatch = StewardReview & {
  matchScore: number | null;
  matchExplanation: Json;
  candidateName: string | null;
  candidateEmail: string | null;
};

function getServerActionClient(): StewardReviewActionsClient {
  return createClient() as unknown as StewardReviewActionsClient;
}

function mapRowToReview(row: StewardReviewRow): StewardReview {
  return {
    id: row.id,
    requestId: row.request_id,
    stewardIdentityId: row.steward_identity_id,
    subjectIdentityId: row.subject_identity_id,
    status: row.status,
    decidedAt: row.decided_at,
    decisionReason: row.decision_reason,
  };
}

function mapRowToMatch(row: StewardReviewRow): StewardReviewMatch {
  return {
    ...mapRowToReview(row),
    matchScore: row.match_score,
    matchExplanation: row.match_explanation,
    candidateName: row.candidate_name,
    candidateEmail: row.candidate_email,
  };
}

export async function listStewardReviewMatches(
  requestId: string,
  options: { supabase?: StewardReviewActionsClient } = {},
): Promise<StewardReviewMatch[]> {
  const supabase = options.supabase ?? getServerActionClient();
  await requireStewardOrAdmin(supabase);

  const { data, error } = await supabase
    .from('steward_reviews')
    .select('*')
    .eq('request_id', requestId)
    .order('match_score', { ascending: false });

  if (error) {
    throw new Error(`Unable to load steward review matches: ${error.message}`);
  }

  return (data ?? []).map(mapRowToMatch);
}

function validateDecisionInput(input: {
  requestId: string;
  reviewId: string;
  intent: StewardReviewActionIntent;
}) {
  if (!input.requestId.trim()) return 'A request id is required.';
  if (!input.reviewId.trim()) return 'A review id is required.';
  if (!['approve', 'reject', 'needs_info'].includes(input.intent))
    return 'A valid review decision is required.';
  return null;
}

export async function decideStewardReviewMatch(
  input: {
    requestId: string;
    reviewId: string;
    intent: StewardReviewActionIntent;
    reason?: string | null;
  },
  options: { supabase?: StewardReviewActionsClient; now?: Date; revalidate?: boolean } = {},
): Promise<StewardReviewActionResult> {
  const validationError = validateDecisionInput(input);

  if (validationError) {
    return { ok: false, error: 'validation', message: validationError };
  }

  const supabase = options.supabase ?? getServerActionClient();
  let identity: Awaited<ReturnType<typeof requireStewardOrAdmin>>;

  try {
    identity = await requireStewardOrAdmin(supabase);
  } catch (error) {
    return toSafeAuthFailureResult(error);
  }

  const { data: row, error: loadError } = await supabase
    .from('steward_reviews')
    .select('*')
    .eq('id', input.reviewId)
    .eq('request_id', input.requestId)
    .single();

  if (loadError) {
    return { ok: false, error: 'persistence', message: 'Unable to load this steward review.' };
  }

  if (!row) {
    return { ok: false, error: 'not_found', message: 'This steward review was not found.' };
  }

  let decision;
  try {
    const decisionInput = {
      review: mapRowToReview(row),
      stewardIdentityId: identity.id,
      reason: input.reason,
      decidedAt: options.now,
    };
    decision =
      input.intent === 'approve'
        ? approveStewardReview(decisionInput)
        : input.intent === 'reject'
          ? rejectStewardReview(decisionInput)
          : requestStewardReviewInfo(decisionInput);
  } catch (error) {
    return {
      ok: false,
      error: 'validation',
      message: error instanceof Error ? error.message : 'Unable to decide this review.',
    };
  }

  const updatePayload: Partial<StewardReviewRow> = {
    status: decision.review.status as StewardReviewStatus,
    decided_at: decision.review.decidedAt,
    decision_reason: decision.review.decisionReason,
  };

  const { data: updated, error: updateError } = await supabase
    .from('steward_reviews')
    .update(updatePayload)
    .eq('id', input.reviewId)
    .eq('request_id', input.requestId)
    .select('*')
    .single();

  if (updateError || !updated) {
    return {
      ok: false,
      error: 'persistence',
      message: 'Unable to save this steward review decision.',
    };
  }

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: decision.event.event_type,
      actor: { type: 'user', id: identity.id },
      target: { type: 'steward_review', id: decision.review.id },
      metadata: decision.event.metadata,
      occurredAt: decision.review.decidedAt ?? undefined,
    }),
  );

  if (options.revalidate !== false) {
    revalidatePath(`/steward/requests/${input.requestId}/matches`);
  }

  return { ok: true, review: mapRowToReview(updated) };
}
