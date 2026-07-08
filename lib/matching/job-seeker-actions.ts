'use server';

import { createAuditEventPayload } from '@/lib/audit';
import { insertAuditEvent, type AuditEventsSupabaseClient } from '@/lib/audit/server';
import { requireCurrentTrustedIdentity, toSafeAuthFailureResult } from '@/lib/auth/steward';
import {
  createJobSeekerRequest,
  type JobSeekerRequestRepositoryClient,
} from '@/lib/matching/job-seeker-repository';
import {
  serializeJobSeekerRequestForPublic,
  validateJobSeekerRequestInput,
} from '@/lib/matching/job-seeker';
import { createClient } from '@/lib/supabase/server';
import type { JobSeekerRequestInput, PublicJobSeekerRequest } from '@/types/matching';

type CreateJobSeekerRequestActionInput = Partial<Omit<JobSeekerRequestInput, 'identityId'>>;

export type CreateJobSeekerRequestActionResult =
  | { ok: true; request: PublicJobSeekerRequest }
  | { ok: false; error: 'validation'; errors: Record<string, string[]> }
  | { ok: false; error: 'auth_required' | 'forbidden'; message: string };

export type JobSeekerRequestActionClient = JobSeekerRequestRepositoryClient &
  AuditEventsSupabaseClient &
  Parameters<typeof requireCurrentTrustedIdentity>[0];

function getServerActionClient(): JobSeekerRequestActionClient {
  return createClient() as unknown as JobSeekerRequestActionClient;
}

export async function createJobSeekerRequestAction(
  input: CreateJobSeekerRequestActionInput,
  options: { supabase?: JobSeekerRequestActionClient; now?: Date } = {},
): Promise<CreateJobSeekerRequestActionResult> {
  const supabase = options.supabase ?? getServerActionClient();
  let identity: Awaited<ReturnType<typeof requireCurrentTrustedIdentity>>;

  try {
    identity = await requireCurrentTrustedIdentity(supabase);
  } catch (error) {
    return toSafeAuthFailureResult(error);
  }

  const ownedInput = { ...input, identityId: identity.id };
  const validation = validateJobSeekerRequestInput(ownedInput);

  if (!validation.valid) {
    return { ok: false, error: 'validation', errors: validation.errors };
  }

  const request = await createJobSeekerRequest(ownedInput as JobSeekerRequestInput, supabase);

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'job_seeker_request.created',
      actor: { type: 'user', id: identity.id },
      target: { type: 'job_seeker_request', id: request.id },
      metadata: {
        status: request.status,
        targetRole: request.targetRole,
      },
      occurredAt: options.now,
    }),
  );

  return { ok: true, request: serializeJobSeekerRequestForPublic(request) };
}
