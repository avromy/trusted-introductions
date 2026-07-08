'use server';

import { createAuditEventPayload } from '@/lib/audit';
import { insertAuditEvent, type AuditEventsSupabaseClient } from '@/lib/audit/server';
import { requireStewardOrAdmin, toSafeAuthFailureResult } from '@/lib/auth/steward';
import { createClient } from '@/lib/supabase/server';
import {
  createIntroduction,
  createSafeIntroductionContext,
  getMatchById,
  type Introduction,
  type IntroductionRepositoryClient,
} from './repository';

export type CreateIntroductionActionClient = Parameters<typeof requireStewardOrAdmin>[0] &
  IntroductionRepositoryClient &
  AuditEventsSupabaseClient;

export type CreateIntroductionActionResult =
  | { ok: true; introduction: Introduction }
  | { ok: false; error: 'auth_required' | 'forbidden' | 'not_found' | 'validation'; message: string };

function getServerActionClient(): CreateIntroductionActionClient {
  return createClient() as unknown as CreateIntroductionActionClient;
}

export async function createIntroductionFromApprovedMatchAction(
  matchId: string,
  options: { supabase?: CreateIntroductionActionClient; now?: Date } = {},
): Promise<CreateIntroductionActionResult> {
  const supabase = options.supabase ?? getServerActionClient();
  const normalizedMatchId = matchId.trim();

  if (!normalizedMatchId) {
    return { ok: false, error: 'validation', message: 'Match id is required.' };
  }

  const match = await getMatchById(normalizedMatchId, supabase);

  if (!match) {
    return { ok: false, error: 'not_found', message: 'Match not found.' };
  }

  if (match.status !== 'approved') {
    return {
      ok: false,
      error: 'validation',
      message: 'Introductions can only be created from approved matches.',
    };
  }

  let actor: Awaited<ReturnType<typeof requireStewardOrAdmin>>;

  try {
    actor = await requireStewardOrAdmin(supabase, { communityId: match.community_id ?? null });
  } catch (error) {
    return toSafeAuthFailureResult(error);
  }

  try {
    const introduction = await createIntroduction(
      {
        match,
        createdByIdentityId: actor.id,
        context: createSafeIntroductionContext(match),
        now: options.now,
      },
      supabase,
    );

    await insertAuditEvent(
      supabase,
      createAuditEventPayload({
        eventType: 'introduction.created',
        actor: { type: 'user', id: actor.id },
        target: { type: 'introduction', id: introduction.id },
        metadata: {
          requestId: match.request_id,
          matchId: match.id,
          requesterIdentityId: match.requester_identity_id,
          helperIdentityId: match.helper_identity_id,
          aiGeneratedEndorsement: false,
          emailSent: false,
        },
        occurredAt: options.now,
      }),
    );

    return { ok: true, introduction };
  } catch (error) {
    return {
      ok: false,
      error: 'validation',
      message: error instanceof Error ? error.message : 'Unable to create introduction.',
    };
  }
}
