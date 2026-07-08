import { createAuditEventPayload, insertAuditEvent } from '@/lib/audit';
import { getCurrentOnboardingProgress } from '@/lib/onboarding/server';
import { createClient } from '@/lib/supabase/server';

import type { AuditEventsSupabaseClient } from '@/lib/audit/server';
import type { CurrentOnboardingProgress } from '@/lib/onboarding/server';

export type CompleteOnboardingActionResult =
  | {
      ok: true;
      progress: CurrentOnboardingProgress;
      persisted: boolean;
    }
  | {
      ok: false;
      error: string;
      progress: CurrentOnboardingProgress;
    };

function getTrustedIdentityId(progress: CurrentOnboardingProgress): string | null {
  const identityId = progress.state.trustedIdentity?.id;

  return typeof identityId === 'string' && identityId.trim().length > 0 ? identityId : null;
}

export async function completeOnboardingAction(): Promise<CompleteOnboardingActionResult> {
  'use server';

  const progress = await getCurrentOnboardingProgress();

  if (!progress.isComplete) {
    return {
      ok: false,
      error: 'Complete all required onboarding steps before finishing onboarding.',
      progress,
    };
  }

  const identityId = getTrustedIdentityId(progress);
  const actorId = identityId ?? progress.state.user.id;
  const now = new Date().toISOString();
  const supabase = createClient() as unknown as AuditEventsSupabaseClient;

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'onboarding.completed',
      actor: { type: 'user', id: actorId },
      target: identityId ? { type: 'trusted_identity', id: identityId } : undefined,
      metadata: {
        persisted: false,
        missingRequirements: progress.missingRequirements,
        checks: progress.checks,
        reason: 'No nullable onboarding completion column is available in the current schema.',
      },
      occurredAt: now,
    }),
  );

  return { ok: true, progress, persisted: false };
}
