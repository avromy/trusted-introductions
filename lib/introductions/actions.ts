'use server';

import { createAuditEventPayload } from '@/lib/audit';
import { insertAuditEvent, type AuditEventsSupabaseClient } from '@/lib/audit/server';
import { requireStewardOrAdmin, toSafeAuthFailureResult } from '@/lib/auth/steward';
import type { SupabaseAuthClient } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/supabase';

import {
  createIntroduction,
  getMatchById,
  type ApprovedMatchRow,
  type IntroductionRepositoryClient,
  type IntroductionRow,
  type SafeIntroductionContext,
} from './repository';

export type IntroductionWorkflowClient = IntroductionRepositoryClient & AuditEventsSupabaseClient & SupabaseAuthClient;

export type CreateIntroductionActionResult =
  | { ok: true; introduction: IntroductionRow }
  | { ok: false; error: 'auth_required' | 'forbidden' | 'not_found' | 'not_approved'; message: string };

export type CreateIntroductionActionDependencies = {
  supabase?: IntroductionWorkflowClient;
  now?: Date;
};

function getServerClient(): IntroductionWorkflowClient {
  return createClient() as unknown as IntroductionWorkflowClient;
}

function normalizeMatchId(matchId: string): string | null {
  const normalized = matchId.trim();
  return normalized ? normalized : null;
}

function isApprovedMatch(match: ApprovedMatchRow): boolean {
  return match.status === 'approved' || match.status === 'steward_approved';
}

function asRecord(value: Json | null | undefined): Record<string, Json> {
  return value && !Array.isArray(value) && typeof value === 'object'
    ? (value as Record<string, Json>)
    : {};
}

function stringArray(value: Json | undefined): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function buildSafeIntroductionContext(input: {
  match: ApprovedMatchRow;
  stewardIdentityId: string;
}): SafeIntroductionContext {
  const matchContext = asRecord(input.match.match_context);
  const request = asRecord(matchContext.request);

  return {
    request: {
      id: input.match.request_id,
      headline: typeof request.headline === 'string' ? request.headline : null,
      targetRole: typeof request.targetRole === 'string' ? request.targetRole : null,
      targetCompanies: stringArray(request.targetCompanies),
      targetLocations: stringArray(request.targetLocations),
    },
    match: {
      id: input.match.id,
      score: input.match.match_score ?? null,
      stewardReviewId: input.match.steward_review_id ?? null,
    },
    requester: { identityId: input.match.requester_identity_id },
    helper: { identityId: input.match.helper_identity_id },
    steward: { identityId: input.stewardIdentityId },
    guardrails: {
      personalEndorsement: false,
      emailNotificationSent: false,
    },
  };
}

export async function createIntroductionFromApprovedMatchAction(
  matchId: string,
  dependencies: CreateIntroductionActionDependencies = {},
): Promise<CreateIntroductionActionResult> {
  const normalizedMatchId = normalizeMatchId(matchId);

  if (!normalizedMatchId) {
    return { ok: false, error: 'not_found', message: 'Match was not found.' };
  }

  const supabase = dependencies.supabase ?? getServerClient();
  const now = dependencies.now ?? new Date();

  let stewardIdentityId: string;
  try {
    const stewardIdentity = await requireStewardOrAdmin(supabase);
    stewardIdentityId = stewardIdentity.id;
  } catch (error) {
    return toSafeAuthFailureResult(error);
  }

  const match = await getMatchById(normalizedMatchId, supabase);

  if (!match) {
    return { ok: false, error: 'not_found', message: 'Match was not found.' };
  }

  if (!isApprovedMatch(match)) {
    return {
      ok: false,
      error: 'not_approved',
      message: 'Only steward-approved matches can become introductions.',
    };
  }

  const safeContext = buildSafeIntroductionContext({ match, stewardIdentityId });
  const introduction = await createIntroduction(
    { match, stewardIdentityId, safeContext, now },
    supabase,
  );

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'introduction.created',
      actor: { type: 'user', id: stewardIdentityId },
      target: { type: 'introduction', id: introduction.id },
      metadata: {
        requestId: introduction.request_id,
        matchId: introduction.match_id,
        requesterIdentityId: introduction.requester_identity_id,
        helperIdentityId: introduction.helper_identity_id,
        status: introduction.status,
        emailNotificationSent: false,
      },
      occurredAt: now,
    }),
  );

  return { ok: true, introduction };
}
