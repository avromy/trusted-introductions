'use server';

import { createAuditEventPayload } from '@/lib/audit';
import { insertAuditEvent, type AuditEventsSupabaseClient } from '@/lib/audit/server';
import { requireStewardOrAdmin, toSafeAuthFailureResult } from '@/lib/auth/steward';
import {
  listHelperCapabilitiesByAvailability,
  type HelperCapabilityRepositoryClient,
  type PersistedHelperCapability,
} from '@/lib/matching/helper-capability-repository';
import {
  getJobSeekerRequestById,
  type JobSeekerRequestRepositoryClient,
} from '@/lib/matching/job-seeker-repository';
import {
  replaceMatchSuggestionsForRequest,
  type MatchSuggestionRepositoryClient,
} from '@/lib/matching/match-repository';
import { rankHelperCandidates } from '@/lib/matching/engine';
import type { HelperCandidate, MatchingRequest } from '@/types/matching';
import { createClient } from '@/lib/supabase/server';
import type { MatchSuggestion } from '@/types/matching';

export type RecalculateMatchSuggestionsActionResult =
  | { ok: true; suggestions: MatchSuggestion[] }
  | { ok: false; error: 'auth_required' | 'forbidden'; message: string }
  | { ok: false; error: 'not_found'; message: string };

export type MatchSuggestionActionClient = JobSeekerRequestRepositoryClient &
  HelperCapabilityRepositoryClient &
  MatchSuggestionRepositoryClient &
  AuditEventsSupabaseClient &
  Parameters<typeof requireStewardOrAdmin>[0];

function getServerActionClient(): MatchSuggestionActionClient {
  return createClient() as unknown as MatchSuggestionActionClient;
}

function toMatchingRequest(request: Awaited<ReturnType<typeof getJobSeekerRequestById>>): MatchingRequest {
  if (!request) {
    return {};
  }

  return {
    id: request.id,
    desiredHelp: [request.targetRole],
    targetCompanies: request.targetCompanies,
    communities: request.targetLocations,
  };
}

function toHelperCandidate(capability: PersistedHelperCapability): HelperCandidate {
  return {
    id: capability.identityId,
    helpTypes: capability.categories,
    industries: capability.industries ?? undefined,
    communities: capability.geographies ?? undefined,
    availability: capability.availability.status,
    relationshipStrength: 0,
    allowMatching: capability.availability.status !== 'unavailable',
  };
}

export async function recalculateMatchSuggestionsAction(
  requestId: string,
  options: { supabase?: MatchSuggestionActionClient; now?: Date } = {},
): Promise<RecalculateMatchSuggestionsActionResult> {
  const supabase = options.supabase ?? getServerActionClient();
  let identity: Awaited<ReturnType<typeof requireStewardOrAdmin>>;

  try {
    identity = await requireStewardOrAdmin(supabase);
  } catch (error) {
    return toSafeAuthFailureResult(error);
  }

  const request = await getJobSeekerRequestById(requestId, supabase);

  if (!request) {
    return { ok: false, error: 'not_found', message: 'Job seeker request was not found.' };
  }

  const eligibleCapabilities = await listHelperCapabilitiesByAvailability('available', supabase);
  const capabilityByIdentityId = new Map(
    eligibleCapabilities.map((capability) => [capability.identityId, capability]),
  );
  const rankedCandidates = rankHelperCandidates(
    toMatchingRequest(request),
    eligibleCapabilities.map(toHelperCandidate),
  );

  const suggestions = await replaceMatchSuggestionsForRequest(
    request.id,
    rankedCandidates.map((candidate, index) => {
      const capability = capabilityByIdentityId.get(candidate.id);

      if (!capability) {
        throw new Error(`Missing helper capability for ranked candidate ${candidate.id}.`);
      }

      return {
        helperIdentityId: capability.identityId,
        helperCapabilityId: capability.id,
        rank: index + 1,
        score: candidate.matchScore,
        reasons: candidate.matchExplanation.reasons,
        metadata: {
          engine: 'deterministic_v1',
          requestStatus: request.status,
          helperAvailabilityStatus: capability.availability.status,
          matchedAt: options.now?.toISOString() ?? new Date().toISOString(),
        },
      };
    }),
    supabase,
  );

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'match_suggestions.recalculated',
      actor: { type: 'user', id: identity.id },
      target: { type: 'job_seeker_request', id: request.id },
      metadata: {
        suggestionCount: suggestions.length,
        topScore: suggestions[0]?.score ?? null,
      },
      occurredAt: options.now,
    }),
  );

  return { ok: true, suggestions };
}
