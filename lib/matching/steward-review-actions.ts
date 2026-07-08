import { createAuditEventPayload } from '@/lib/audit';
import { insertAuditEvent, type AuditEventsSupabaseClient } from '@/lib/audit/server';
import { requireStewardOrAdmin, toSafeAuthFailureResult } from '@/lib/auth/steward';
import type { SupabaseAuthClient } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { AuditEventPayload } from '@/types/audit';
import type { Database, Json } from '@/types/supabase';

export const STEWARD_MATCH_REVIEW_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'needs_info',
] as const;
export type StewardMatchReviewStatus = (typeof STEWARD_MATCH_REVIEW_STATUSES)[number];
export type StewardMatchReviewDecision = Exclude<StewardMatchReviewStatus, 'pending'>;
export const STEWARD_MATCH_REVIEW_DECISIONS = [
  'approved',
  'rejected',
  'needs_info',
] as const satisfies readonly StewardMatchReviewDecision[];

type JobSeekerRequestRow = Database['public']['Tables']['job_seeker_requests']['Row'];
type MatchSuggestionRow = Database['public']['Tables']['match_suggestions']['Row'];
type StewardReviewRow = Database['public']['Tables']['steward_reviews']['Row'];

type QueryResult<T> = Promise<{ data: T; error: Error | { message?: string } | null }>;
type Builder<T> = {
  select(columns?: string): Builder<T>;
  insert(payload: unknown): Builder<T>;
  update(payload: unknown): Builder<T>;
  eq(column: string, value: unknown): Builder<T>;
  order(column: string, options: { ascending: boolean }): QueryResult<T[]>;
  maybeSingle(): QueryResult<T | null>;
  single(): QueryResult<T>;
};

export type StewardMatchReviewClient = SupabaseAuthClient & {
  from(table: 'audit_events'): ReturnType<AuditEventsSupabaseClient['from']>;
  from(table: 'trusted_identities' | 'user_roles'): any;
  from(table: 'job_seeker_requests'): Builder<JobSeekerRequestRow>;
  from(table: 'match_suggestions'): Builder<MatchSuggestionRow>;
  from(table: 'steward_reviews'): Builder<StewardReviewRow>;
};

export type StewardMatchSuggestion = {
  id: string;
  requestId: string;
  helperIdentityId: string;
  status: StewardMatchReviewStatus;
  matchScore: number;
  matchExplanation: { score?: number; reasons: string[] } & Record<string, Json | undefined>;
  stewardReviewId: string | null;
  decisionReason: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export type StewardMatchReviewPageData = {
  request: {
    id: string;
    headline: string;
    targetRole: string;
    targetCompanies: string[];
    targetLocations: string[];
    remotePreference: string | null;
    status: JobSeekerRequestRow['status'];
    notes: string | null;
    createdAt: string;
  };
  matches: StewardMatchSuggestion[];
};

export type StewardMatchReviewActionResult =
  | { ok: true; match: StewardMatchSuggestion; auditEvent: AuditEventPayload }
  | {
      ok: false;
      error:
        'auth_required' | 'forbidden' | 'not_found' | 'invalid_transition' | 'persistence_error';
      message: string;
    };

function getClient(client?: StewardMatchReviewClient): StewardMatchReviewClient {
  return client ?? (createClient() as unknown as StewardMatchReviewClient);
}

function errorMessage(error: Error | { message?: string } | null): string {
  return error?.message ?? 'unknown Supabase error';
}

function isStatus(value: string): value is StewardMatchReviewStatus {
  return STEWARD_MATCH_REVIEW_STATUSES.includes(value as StewardMatchReviewStatus);
}

function normalizeExplanation(value: Json): StewardMatchSuggestion['matchExplanation'] {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const object = value as Record<string, Json | undefined>;
    const reasons = Array.isArray(object.reasons)
      ? object.reasons.filter((reason): reason is string => typeof reason === 'string')
      : [];
    return {
      ...object,
      reasons,
      score: typeof object.score === 'number' ? object.score : undefined,
    };
  }
  return { reasons: [] };
}

function mapSuggestion(
  row: MatchSuggestionRow,
  review?: StewardReviewRow | null,
): StewardMatchSuggestion {
  const status = review?.status ?? row.status;
  return {
    id: row.id,
    requestId: row.request_id,
    helperIdentityId: row.helper_identity_id,
    status: isStatus(status) ? status : 'pending',
    matchScore: row.match_score,
    matchExplanation: normalizeExplanation(row.match_explanation),
    stewardReviewId: review?.id ?? null,
    decisionReason: review?.decision_reason ?? null,
    decidedAt: review?.decided_at ?? null,
    createdAt: row.created_at,
  };
}

export async function getStewardMatchReviewPageData(
  requestId: string,
  client?: StewardMatchReviewClient,
): Promise<StewardMatchReviewPageData> {
  const supabase = getClient(client);
  await requireStewardOrAdmin(supabase);

  const { data: request, error: requestError } = await supabase
    .from('job_seeker_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();
  if (requestError) throw new Error(`Failed to load request: ${errorMessage(requestError)}`);
  if (!request) throw new Error('Request not found.');

  const { data: suggestions, error: suggestionsError } = await supabase
    .from('match_suggestions')
    .select('*')
    .eq('request_id', requestId)
    .order('match_score', { ascending: false });
  if (suggestionsError)
    throw new Error(`Failed to load match suggestions: ${errorMessage(suggestionsError)}`);

  const matches = await Promise.all(
    (suggestions ?? []).map(async (suggestion) => {
      const { data: review, error: reviewError } = await supabase
        .from('steward_reviews')
        .select('*')
        .eq('match_suggestion_id', suggestion.id)
        .maybeSingle();
      if (reviewError)
        throw new Error(`Failed to load steward review: ${errorMessage(reviewError)}`);
      return mapSuggestion(suggestion, review);
    }),
  );

  return {
    request: {
      id: request.id,
      headline: request.headline,
      targetRole: request.target_role,
      targetCompanies: request.target_companies,
      targetLocations: request.target_locations,
      remotePreference: request.remote_preference,
      status: request.status,
      notes: request.notes,
      createdAt: request.created_at,
    },
    matches,
  };
}

function canTransition(from: StewardMatchReviewStatus, to: StewardMatchReviewDecision): boolean {
  if (from === 'approved' || from === 'rejected') return false;
  return to === 'approved' || to === 'rejected' || to === 'needs_info';
}

export async function decideStewardMatchReview(
  input: {
    matchSuggestionId: string;
    decision: StewardMatchReviewDecision;
    reason?: string | null;
  },
  client?: StewardMatchReviewClient,
): Promise<StewardMatchReviewActionResult> {
  const supabase = getClient(client);
  let actorId: string;
  try {
    const identity = await requireStewardOrAdmin(supabase);
    actorId = identity.id;
  } catch (error) {
    return toSafeAuthFailureResult(error);
  }

  if (!STEWARD_MATCH_REVIEW_DECISIONS.includes(input.decision)) {
    return {
      ok: false,
      error: 'invalid_transition',
      message: 'Unsupported steward review decision.',
    };
  }

  const { data: suggestion, error: suggestionError } = await supabase
    .from('match_suggestions')
    .select('*')
    .eq('id', input.matchSuggestionId)
    .maybeSingle();
  if (suggestionError)
    return { ok: false, error: 'persistence_error', message: errorMessage(suggestionError) };
  if (!suggestion) return { ok: false, error: 'not_found', message: 'Match suggestion not found.' };

  const { data: existingReview, error: reviewLoadError } = await supabase
    .from('steward_reviews')
    .select('*')
    .eq('match_suggestion_id', suggestion.id)
    .maybeSingle();
  if (reviewLoadError)
    return { ok: false, error: 'persistence_error', message: errorMessage(reviewLoadError) };

  const currentStatus = existingReview?.status ?? suggestion.status;
  if (!canTransition(currentStatus, input.decision)) {
    return {
      ok: false,
      error: 'invalid_transition',
      message: `Cannot change a ${currentStatus} review.`,
    };
  }

  const now = new Date().toISOString();
  const reason = input.reason?.trim() || null;
  const reviewPayload = {
    request_id: suggestion.request_id,
    match_suggestion_id: suggestion.id,
    steward_identity_id: actorId,
    subject_identity_id: suggestion.helper_identity_id,
    status: input.decision,
    decision_reason: reason,
    decided_at: now,
  };

  const reviewWrite = existingReview
    ? supabase
        .from('steward_reviews')
        .update(reviewPayload)
        .eq('id', existingReview.id)
        .select('*')
        .single()
    : supabase.from('steward_reviews').insert(reviewPayload).select('*').single();
  const { data: review, error: reviewWriteError } = await reviewWrite;
  if (reviewWriteError)
    return { ok: false, error: 'persistence_error', message: errorMessage(reviewWriteError) };

  const { data: updatedSuggestion, error: suggestionUpdateError } = await supabase
    .from('match_suggestions')
    .update({ status: input.decision, reviewed_at: now, steward_review_id: review.id })
    .eq('id', suggestion.id)
    .select('*')
    .single();
  if (suggestionUpdateError)
    return { ok: false, error: 'persistence_error', message: errorMessage(suggestionUpdateError) };

  const auditEvent = createAuditEventPayload({
    eventType: `steward_match_review.${input.decision}`,
    actor: { type: 'user', id: actorId },
    target: { type: 'match_suggestions', id: suggestion.id },
    metadata: {
      requestId: suggestion.request_id,
      helperIdentityId: suggestion.helper_identity_id,
      previousStatus: currentStatus,
      status: input.decision,
      hasPrivateDecisionReason: reason !== null,
      decisionReasonLength: reason?.length ?? 0,
    },
    occurredAt: now,
  });
  await insertAuditEvent(supabase, auditEvent);

  return { ok: true, match: mapSuggestion(updatedSuggestion, review), auditEvent };
}

export async function recalculateStewardMatchReview(
  input: { requestId: string },
  client?: StewardMatchReviewClient,
): Promise<
  | { ok: true; auditEvent: AuditEventPayload }
  | Exclude<StewardMatchReviewActionResult, { ok: true }>
> {
  const supabase = getClient(client);
  try {
    const identity = await requireStewardOrAdmin(supabase);
    const now = new Date().toISOString();
    const auditEvent = createAuditEventPayload({
      eventType: 'steward_match_review.recalculated',
      actor: { type: 'user', id: identity.id },
      target: { type: 'job_seeker_requests', id: input.requestId },
      metadata: { requestId: input.requestId },
      occurredAt: now,
    });
    await insertAuditEvent(supabase, auditEvent);
    return { ok: true, auditEvent };
  } catch (error) {
    if (error instanceof Error && !('code' in error)) {
      return { ok: false, error: 'persistence_error', message: error.message };
    }
    return toSafeAuthFailureResult(error);
  }
}
