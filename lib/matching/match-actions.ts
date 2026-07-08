'use server';

import { createAuditEventPayload } from '@/lib/audit';
import { insertAuditEvent, type AuditEventsSupabaseClient } from '@/lib/audit/server';
import { requireStewardOrAdmin, toSafeAuthFailureResult } from '@/lib/auth/steward';
import { rankHelperCandidates, type HelperCandidate } from '@/lib/matching/engine';
import {
  getJobSeekerRequestById,
  type JobSeekerRequestRepositoryClient,
} from '@/lib/matching/job-seeker-repository';
import {
  replaceMatchSuggestionsForRequest,
  type MatchSuggestionRepositoryClient,
} from '@/lib/matching/match-repository';
import { createClient } from '@/lib/supabase/server';
import type { MatchSuggestion } from '@/types/matching';

export type RecalculateMatchSuggestionsActionResult =
  | { ok: true; suggestions: MatchSuggestion[] }
  | {
      ok: false;
      error: 'auth_required' | 'forbidden' | 'not_found' | 'validation';
      message: string;
    };

export type MatchSuggestionActionClient = JobSeekerRequestRepositoryClient &
  MatchSuggestionRepositoryClient &
  AuditEventsSupabaseClient &
  Parameters<typeof requireStewardOrAdmin>[0];

function getServerActionClient(): MatchSuggestionActionClient {
  return createClient() as unknown as MatchSuggestionActionClient;
}

function normalizeDesiredHelp(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

export async function recalculateMatchSuggestionsAction(
  input: {
    requestId: string;
    helperCandidates: readonly HelperCandidate[];
    desiredHelp?: readonly string[];
    targetIndustries?: readonly string[];
    communities?: readonly string[];
  },
  options: { supabase?: MatchSuggestionActionClient; now?: Date } = {},
): Promise<RecalculateMatchSuggestionsActionResult> {
  const supabase = options.supabase ?? getServerActionClient();
  let steward: Awaited<ReturnType<typeof requireStewardOrAdmin>>;

  try {
    steward = await requireStewardOrAdmin(supabase);
  } catch (error) {
    return toSafeAuthFailureResult(error);
  }

  if (!input.requestId.trim()) {
    return { ok: false, error: 'validation', message: 'Request id is required.' };
  }

  const request = await getJobSeekerRequestById(input.requestId, supabase);

  if (!request) {
    return { ok: false, error: 'not_found', message: 'Job seeker request was not found.' };
  }

  const rankedCandidates = rankHelperCandidates(
    {
      id: request.id,
      desiredHelp: normalizeDesiredHelp(input.desiredHelp),
      targetCompanies: request.targetCompanies,
      targetIndustries: normalizeDesiredHelp(input.targetIndustries),
      communities: normalizeDesiredHelp(input.communities),
    },
    input.helperCandidates,
  );

  const suggestions = await replaceMatchSuggestionsForRequest(
    {
      requestId: request.id,
      suggestions: rankedCandidates,
      recalculatedByIdentityId: steward.id,
      recalculatedAt: options.now,
    },
    supabase,
  );

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'match_suggestions.recalculated',
      actor: { type: 'user', id: steward.id },
      target: { type: 'job_seeker_request', id: request.id },
      metadata: {
        suggestionCount: suggestions.length,
        helperCandidateCount: input.helperCandidates.length,
      },
      occurredAt: options.now,
    }),
  );

  return { ok: true, suggestions };
}
