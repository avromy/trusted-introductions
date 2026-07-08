import { createAuditEventPayload, insertAuditEvent } from '@/lib/audit';
import {
  requireCurrentIdentity,
  type AuthIdentity,
  type SupabaseAuthClient,
} from '@/lib/auth/session';
import {
  type HelperCapabilityUpsertInput,
  type HelperCapabilitySafeResult,
  upsertHelperCapability,
} from '@/lib/matching/helper-capability-repository';
import {
  createHelperCapability,
  serializeHelperCapability,
  validateHelperCapabilityInput,
} from '@/lib/matching/helper-capability';
import { createClient } from '@/lib/supabase/server';

export type SaveHelperCapabilityActionInput =
  Partial<HelperCapabilityUpsertInput> | null | undefined;

export type SaveHelperCapabilityActionResult =
  | { ok: true; capability: HelperCapabilitySafeResult }
  | { ok: false; errors: string[]; capability: HelperCapabilitySafeResult | null };

type HelperCapabilityActionClient = SupabaseAuthClient &
  import('@/lib/matching/helper-capability-repository').HelperCapabilitySupabaseClient &
  import('@/lib/audit/server').AuditEventsSupabaseClient;

function trustedIdentityId(identity: AuthIdentity): string | null {
  const id = identity.id ?? identity.identity_id ?? identity.user_id;

  return typeof id === 'string' && id.trim().length > 0 ? id : null;
}

function safeInvalidCapability(
  input: SaveHelperCapabilityActionInput,
): HelperCapabilitySafeResult | null {
  if (!input) {
    return null;
  }

  const capability = createHelperCapability(input);

  return {
    ...serializeHelperCapability(capability),
    visibility:
      input.visibility === 'community' || input.visibility === 'stewards'
        ? input.visibility
        : 'private',
  };
}

export async function saveHelperCapabilityAction(
  input: SaveHelperCapabilityActionInput,
): Promise<SaveHelperCapabilityActionResult> {
  'use server';

  const errors = validateHelperCapabilityInput(input);

  if (errors.length > 0) {
    return { ok: false, errors, capability: safeInvalidCapability(input) };
  }

  const supabase = createClient() as unknown as HelperCapabilityActionClient;
  const identity = await requireCurrentIdentity(supabase);
  const identityId = trustedIdentityId(identity);

  if (!identityId) {
    return { ok: false, errors: ['A trusted identity id is required.'], capability: null };
  }

  const capability = await upsertHelperCapability(
    supabase,
    identityId,
    input as HelperCapabilityUpsertInput,
  );

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'helper_capability.updated',
      actor: { type: 'user', id: identityId },
      target: { type: 'trusted_identity', id: identityId },
      metadata: { capability },
    }),
  );

  return { ok: true, capability };
}
