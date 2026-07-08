'use server';

import { createAuditEventPayload } from '@/lib/audit';
import { insertAuditEvent, type AuditEventsSupabaseClient } from '@/lib/audit/server';
import { requireStewardOrAdmin, toSafeAuthFailureResult } from '@/lib/auth/steward';
import {
  createIntroduction,
  markIntroductionSent,
  type Introduction,
  type IntroductionRepositoryClient,
} from '@/lib/introductions/repository';
import { createClient } from '@/lib/supabase/server';

export type CreateIntroductionActionInput = {
  matchId?: string;
  requesterIdentityId?: string;
  helperIdentityId?: string;
  stewardNote?: string | null;
};

export type IntroductionActionResult =
  | { ok: true; introduction: Introduction }
  | { ok: false; error: 'validation'; errors: Record<string, string[]> }
  | { ok: false; error: 'auth_required' | 'forbidden'; message: string };

export type IntroductionActionClient = IntroductionRepositoryClient &
  AuditEventsSupabaseClient &
  Parameters<typeof requireStewardOrAdmin>[0];

function getServerActionClient(): IntroductionActionClient {
  return createClient() as unknown as IntroductionActionClient;
}

function validateCreateIntroductionInput(
  input: CreateIntroductionActionInput,
): { valid: true } | { valid: false; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};

  if (!input.matchId?.trim()) {
    errors.matchId = ['An approved match is required.'];
  }

  if (!input.requesterIdentityId?.trim()) {
    errors.requesterIdentityId = ['A requester identity is required.'];
  }

  if (!input.helperIdentityId?.trim()) {
    errors.helperIdentityId = ['A helper identity is required.'];
  }

  return Object.keys(errors).length > 0 ? { valid: false, errors } : { valid: true };
}

export async function createIntroductionAction(
  input: CreateIntroductionActionInput,
  options: { supabase?: IntroductionActionClient; now?: Date } = {},
): Promise<IntroductionActionResult> {
  const supabase = options.supabase ?? getServerActionClient();
  let steward: Awaited<ReturnType<typeof requireStewardOrAdmin>>;

  try {
    steward = await requireStewardOrAdmin(supabase);
  } catch (error) {
    return toSafeAuthFailureResult(error);
  }

  const validation = validateCreateIntroductionInput(input);

  if (!validation.valid) {
    return { ok: false, error: 'validation', errors: validation.errors };
  }

  const introduction = await createIntroduction(
    {
      matchId: input.matchId!,
      requesterIdentityId: input.requesterIdentityId!,
      helperIdentityId: input.helperIdentityId!,
      stewardIdentityId: steward.id,
      stewardNote: input.stewardNote,
      now: options.now,
    },
    supabase,
  );

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'introduction.created',
      actor: { type: 'user', id: steward.id },
      target: { type: 'introduction', id: introduction.id },
      metadata: {
        matchId: introduction.matchId,
        requesterIdentityId: introduction.requesterIdentityId,
        helperIdentityId: introduction.helperIdentityId,
      },
      occurredAt: options.now,
    }),
  );

  return { ok: true, introduction };
}

export async function sendIntroductionAction(
  introductionId: string,
  options: { supabase?: IntroductionActionClient; now?: Date } = {},
): Promise<IntroductionActionResult> {
  const supabase = options.supabase ?? getServerActionClient();
  let steward: Awaited<ReturnType<typeof requireStewardOrAdmin>>;

  try {
    steward = await requireStewardOrAdmin(supabase);
  } catch (error) {
    return toSafeAuthFailureResult(error);
  }

  if (!introductionId.trim()) {
    return { ok: false, error: 'validation', errors: { introductionId: ['Introduction id is required.'] } };
  }

  const introduction = await markIntroductionSent(introductionId, supabase, options.now);

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'introduction.sent',
      actor: { type: 'user', id: steward.id },
      target: { type: 'introduction', id: introduction.id },
      metadata: { matchId: introduction.matchId },
      occurredAt: options.now,
    }),
  );

  return { ok: true, introduction };
}
