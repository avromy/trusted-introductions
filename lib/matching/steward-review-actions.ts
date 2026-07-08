import { requireStewardOrAdmin, toSafeAuthFailureResult } from '@/lib/auth/steward';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseAuthClient } from '@/lib/auth/session';
import type { TrustedIdentityRepositoryClient, TrustedIdentityWithRoles } from '@/lib/identity';
import type { Json } from '@/types/supabase';

export const MATCH_REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'needs_info'] as const;
export type MatchReviewStatus = (typeof MATCH_REVIEW_STATUSES)[number];
export type MatchReviewDecision = Exclude<MatchReviewStatus, 'pending'>;

export type PersistedMatchSuggestion = {
  id: string;
  request_id: string;
  helper_identity_id: string;
  score: number | null;
  explanation: Json;
  review_status: MatchReviewStatus;
  reviewed_by_identity_id: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  created_at: string;
  updated_at: string;
};

type AuditPayload = {
  event_type: string;
  actor_identity_id: string;
  subject_table: string;
  subject_id: string;
  metadata: Record<string, Json>;
};

type ReviewActionClient = SupabaseAuthClient & TrustedIdentityRepositoryClient & {
  from(table: 'match_suggestions'): {
    select(columns?: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{ data: PersistedMatchSuggestion | null; error: Error | null }>;
        order(column: string, options?: { ascending?: boolean }): Promise<{ data: PersistedMatchSuggestion[] | null; error: Error | null }>;
      };
    };
    update(payload: Partial<PersistedMatchSuggestion>): {
      eq(column: string, value: string): {
        select(columns?: string): {
          single(): Promise<{ data: PersistedMatchSuggestion | null; error: Error | null }>;
        };
      };
    };
  };
  from(table: 'audit_events'): {
    insert(payload: AuditPayload): Promise<{ error: Error | null }>;
  };
};

export type MatchReviewActionResult =
  | { ok: true; suggestion: PersistedMatchSuggestion }
  | { ok: false; error: 'auth_required' | 'forbidden' | 'not_found' | 'invalid_request'; message: string };

export type RecalculateMatchSuggestionsResult =
  | { ok: true; suggestions: PersistedMatchSuggestion[] }
  | { ok: false; error: 'auth_required' | 'forbidden' | 'invalid_request'; message: string };

const SUGGESTION_COLUMNS =
  'id, request_id, helper_identity_id, score, explanation, review_status, reviewed_by_identity_id, reviewed_at, review_reason, created_at, updated_at';

function getServerClient(): ReviewActionClient {
  return createClient() as unknown as ReviewActionClient;
}

function normalizeReason(reason?: string | null): string | null {
  const normalized = reason?.trim();
  return normalized ? normalized : null;
}

function isMatchReviewDecision(value: string): value is MatchReviewDecision {
  return value === 'approved' || value === 'rejected' || value === 'needs_info';
}

function assertNonEmpty(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`${label} is required.`);
  }
}

function stewardCommunityId(identity: TrustedIdentityWithRoles): string | null | undefined {
  return identity.roles.find((role) => role.role === 'steward' || role.role === 'admin')?.community_id;
}

async function insertMatchReviewAuditEvent(
  client: ReviewActionClient,
  input: {
    actorIdentityId: string;
    suggestion: PersistedMatchSuggestion;
    previousStatus: MatchReviewStatus;
    nextStatus: MatchReviewStatus;
    reason: string | null;
    eventType: string;
  },
): Promise<void> {
  const { error } = await client.from('audit_events').insert({
    event_type: input.eventType,
    actor_identity_id: input.actorIdentityId,
    subject_table: 'match_suggestions',
    subject_id: input.suggestion.id,
    metadata: {
      requestId: input.suggestion.request_id,
      helperIdentityId: input.suggestion.helper_identity_id,
      previousStatus: input.previousStatus,
      status: input.nextStatus,
      hasReason: input.reason !== null,
      reasonLength: input.reason?.length ?? 0,
    },
  });

  if (error) {
    throw error;
  }
}

export async function reviewMatchSuggestionAction(
  input: { suggestionId: string; decision: string; reason?: string | null },
  client: ReviewActionClient = getServerClient(),
): Promise<MatchReviewActionResult> {
  try {
    assertNonEmpty(input.suggestionId, 'Match suggestion id');

    if (!isMatchReviewDecision(input.decision)) {
      return { ok: false, error: 'invalid_request', message: 'Unsupported review decision.' };
    }

    const steward = await requireStewardOrAdmin(client);
    const { data: existing, error: lookupError } = await client
      .from('match_suggestions')
      .select(SUGGESTION_COLUMNS)
      .eq('id', input.suggestionId)
      .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    if (!existing) {
      return { ok: false, error: 'not_found', message: 'Match suggestion was not found.' };
    }

    if (existing.review_status === 'approved' || existing.review_status === 'rejected') {
      return { ok: false, error: 'invalid_request', message: 'Final match reviews cannot be changed.' };
    }

    const reason = normalizeReason(input.reason);
    const { data: suggestion, error: updateError } = await client
      .from('match_suggestions')
      .update({
        review_status: input.decision,
        reviewed_by_identity_id: steward.id,
        reviewed_at: new Date().toISOString(),
        review_reason: reason,
      })
      .eq('id', existing.id)
      .select(SUGGESTION_COLUMNS)
      .single();

    if (updateError) {
      throw updateError;
    }

    if (!suggestion) {
      throw new Error('Match suggestion review update did not return a row.');
    }

    await insertMatchReviewAuditEvent(client, {
      actorIdentityId: steward.id,
      suggestion,
      previousStatus: existing.review_status,
      nextStatus: input.decision,
      reason,
      eventType: `match_suggestion.${input.decision}`,
    });

    return { ok: true, suggestion };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Match suggestion id')) {
      return { ok: false, error: 'invalid_request', message: error.message };
    }

    return toSafeAuthFailureResult(error);
  }
}

export async function recalculateMatchSuggestionsAction(
  input: { requestId: string },
  client: ReviewActionClient = getServerClient(),
): Promise<RecalculateMatchSuggestionsResult> {
  try {
    assertNonEmpty(input.requestId, 'Request id');
    const steward = await requireStewardOrAdmin(client);
    void stewardCommunityId(steward);
    const { data, error } = await client
      .from('match_suggestions')
      .update({ review_status: 'pending', reviewed_by_identity_id: null, reviewed_at: null, review_reason: null })
      .eq('request_id', input.requestId)
      .select(SUGGESTION_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    const suggestions = data ? [data] : [];
    await client.from('audit_events').insert({
      event_type: 'match_suggestions.recalculated',
      actor_identity_id: steward.id,
      subject_table: 'job_seeker_requests',
      subject_id: input.requestId,
      metadata: { requestId: input.requestId, suggestionCount: suggestions.length },
    });

    return { ok: true, suggestions };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Request id')) {
      return { ok: false, error: 'invalid_request', message: error.message };
    }

    return toSafeAuthFailureResult(error);
  }
}
