'use server';

import { createAuditEventPayload } from '@/lib/audit';
import { insertAuditEvent, type AuditEventsSupabaseClient } from '@/lib/audit/server';
import { requireCurrentTrustedIdentity, toSafeAuthFailureResult } from '@/lib/auth/steward';
import {
  serializePersistedHelperCapabilityForPublic,
  upsertHelperCapability,
  type HelperCapabilityRepositoryClient,
  type HelperCapabilityUpsertInput,
  type PublicPersistedHelperCapability,
} from '@/lib/matching/helper-capability-repository';
import {
  validateHelperCapabilityInput,
  type HelperCapabilityInput,
} from '@/lib/matching/helper-capability';
import { createClient } from '@/lib/supabase/server';

type UpsertHelperCapabilityActionInput = Partial<HelperCapabilityInput>;

export type UpsertHelperCapabilityActionResult =
  | { ok: true; capability: PublicPersistedHelperCapability }
  | { ok: false; error: 'validation'; errors: string[] }
  | { ok: false; error: 'auth_required' | 'forbidden'; message: string };

export type HelperCapabilityActionClient = HelperCapabilityRepositoryClient &
  AuditEventsSupabaseClient &
  Parameters<typeof requireCurrentTrustedIdentity>[0];

function getServerActionClient(): HelperCapabilityActionClient {
  return createClient() as unknown as HelperCapabilityActionClient;
}

export async function upsertHelperCapabilityAction(
  input: UpsertHelperCapabilityActionInput,
  options: { supabase?: HelperCapabilityActionClient; now?: Date } = {},
): Promise<UpsertHelperCapabilityActionResult> {
  const supabase = options.supabase ?? getServerActionClient();
  let identity: Awaited<ReturnType<typeof requireCurrentTrustedIdentity>>;

  try {
    identity = await requireCurrentTrustedIdentity(supabase);
  } catch (error) {
    return toSafeAuthFailureResult(error);
  }

  const validationErrors = validateHelperCapabilityInput(input);

  if (validationErrors.length > 0) {
    return { ok: false, error: 'validation', errors: validationErrors };
  }

  const capability = await upsertHelperCapability(
    { ...input, identityId: identity.id } as HelperCapabilityUpsertInput,
    supabase,
  );

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'helper_capability.upserted',
      actor: { type: 'user', id: identity.id },
      target: { type: 'helper_capability', id: capability.id },
      metadata: {
        categories: capability.categories,
        availabilityStatus: capability.availability.status,
        weeklyIntroCapacity: capability.availability.weeklyIntroCapacity,
      },
      occurredAt: options.now,
    }),
  );

  return { ok: true, capability: serializePersistedHelperCapabilityForPublic(capability) };
}
