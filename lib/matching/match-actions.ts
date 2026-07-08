'use server';

import { createAuditEventPayload, insertAuditEvent } from '@/lib/audit';
import { requireStewardOrAdmin, toSafeAuthFailureResult } from '@/lib/auth/steward';
import {
  rankHelperCandidates,
  type HelperCandidate,
  type MatchingRequest,
} from '@/lib/matching/engine';
import {
  createMatchSuggestion,
  createMatchSuggestionExplanation,
  getJobSeekerRequestById,
  listEligibleHelperCapabilities,
  listMatchSuggestionsForRequest,
  type MatchRepositorySupabaseClient,
  type MatchSuggestion,
} from '@/lib/matching/match-repository';
import { createClient } from '@/lib/supabase/server';

export type RecalculateMatchesResult =
  | { ok: true; suggestions: MatchSuggestion[] }
  | { ok: false; error: 'auth_required' | 'forbidden' | 'not_found'; message: string };

type MatchActionClient = MatchRepositorySupabaseClient &
  Parameters<typeof requireStewardOrAdmin>[0] &
  Parameters<typeof insertAuditEvent>[0];

function requestToMatchingRequest(
  request: Awaited<ReturnType<typeof getJobSeekerRequestById>>,
): MatchingRequest {
  if (!request) {
    throw new Error('Request is required.');
  }

  return {
    id: request.id,
    desiredHelp: [request.targetRole],
    targetCompanies: request.targetCompanies,
    targetIndustries: [],
    communities: request.targetLocations,
  };
}

function toCandidate(
  row: Awaited<ReturnType<typeof listEligibleHelperCapabilities>>[number],
): HelperCandidate {
  return {
    id: row.identity_id,
    helpTypes: row.categories ?? [],
    industries: row.industries ?? [],
    communities: row.geographies ?? [],
    companies: [],
    availability: row.availability?.status,
    relationshipStrength: row.relationship_strength ?? undefined,
    allowMatching: row.allow_matching ?? true,
  };
}

export async function recalculateMatchesForRequestAction(
  requestId: string,
): Promise<RecalculateMatchesResult> {
  const supabase = createClient() as unknown as MatchActionClient;

  let actor;
  try {
    actor = await requireStewardOrAdmin(supabase);
  } catch (error) {
    return toSafeAuthFailureResult(error);
  }

  const request = await getJobSeekerRequestById(supabase, requestId);
  if (!request) {
    return { ok: false, error: 'not_found', message: 'Job seeker request was not found.' };
  }

  const matchingRequest = requestToMatchingRequest(request);
  const helpers = await listEligibleHelperCapabilities(supabase);
  const ranked = rankHelperCandidates(matchingRequest, helpers.map(toCandidate));

  for (const helper of ranked) {
    await createMatchSuggestion(supabase, {
      requestId: request.id,
      helperIdentityId: helper.id,
      score: helper.matchScore,
      explanation: createMatchSuggestionExplanation({
        explanation: helper.matchExplanation,
        desiredHelp: matchingRequest.desiredHelp,
        targetCompanies: matchingRequest.targetCompanies,
        targetIndustries: helper.industries,
        communities: helper.communities,
        availability: helper.availability,
      }),
    });
  }

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'match_suggestions.recalculated',
      actor: { type: 'user', id: actor.id },
      target: { type: 'job_seeker_request', id: request.id },
      metadata: {
        requestId: request.id,
        helperCount: helpers.length,
        suggestionCount: ranked.length,
      },
    }),
  );

  return { ok: true, suggestions: await listMatchSuggestionsForRequest(supabase, request.id) };
}
