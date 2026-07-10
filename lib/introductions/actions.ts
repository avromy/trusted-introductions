'use server';

import { createAuditEventPayload } from '@/lib/audit';
import { insertAuditEvent, type AuditEventsSupabaseClient } from '@/lib/audit/server';
import { requireStewardOrAdmin, toSafeAuthFailureResult } from '@/lib/auth/steward';
import {
  createIntroduction,
  type Introduction,
  type IntroductionRepositoryClient,
} from '@/lib/introductions/repository';
import {
  enqueueIntroductionCoordinationNotifications,
  type IntroductionCoordinationNotificationOutboxClient,
} from '@/lib/notifications/introduction/coordination';
import {
  getJobSeekerRequestById,
  type JobSeekerRequestRepositoryClient,
} from '@/lib/matching/job-seeker-repository';
import {
  getStewardReviewById,
  type StewardReviewRepositoryClient,
} from '@/lib/matching/steward-review-repository';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/supabase';

export type CreateIntroductionActionResult =
  | { ok: true; introduction: Introduction }
  | { ok: false; error: 'auth_required' | 'forbidden'; message: string }
  | { ok: false; error: 'not_found' | 'not_approved' | 'invalid_match'; message: string };

export type CreateIntroductionActionClient = IntroductionRepositoryClient &
  StewardReviewRepositoryClient &
  JobSeekerRequestRepositoryClient &
  AuditEventsSupabaseClient &
  IntroductionCoordinationNotificationOutboxClient &
  Parameters<typeof requireStewardOrAdmin>[0];

function getServerActionClient(): CreateIntroductionActionClient {
  return createClient() as unknown as CreateIntroductionActionClient;
}

function safeIntroductionContext(reviewId: string): Json {
  return {
    source: 'steward_review',
    stewardReviewId: reviewId,
    messageContentStored: false,
  };
}

export async function createIntroductionFromStewardReviewAction(
  stewardReviewId: string,
  options: { supabase?: CreateIntroductionActionClient; now?: Date } = {},
): Promise<CreateIntroductionActionResult> {
  const supabase = options.supabase ?? getServerActionClient();
  let identity: Awaited<ReturnType<typeof requireStewardOrAdmin>>;

  try {
    identity = await requireStewardOrAdmin(supabase);
  } catch (error) {
    return toSafeAuthFailureResult(error);
  }

  const review = await getStewardReviewById(stewardReviewId, supabase);

  if (!review) {
    return { ok: false, error: 'not_found', message: 'Steward review was not found.' };
  }

  if (review.status !== 'approved') {
    return {
      ok: false,
      error: 'not_approved',
      message: 'Introductions can only be created from approved steward matches.',
    };
  }

  if (!review.matchSuggestionId) {
    return {
      ok: false,
      error: 'invalid_match',
      message: 'Approved review is not linked to a match suggestion.',
    };
  }

  const request = await getJobSeekerRequestById(review.requestId, supabase);

  if (!request) {
    return { ok: false, error: 'not_found', message: 'Reviewed request was not found.' };
  }

  const introduction = await createIntroduction(
    {
      requestId: review.requestId,
      matchId: review.matchSuggestionId,
      stewardReviewId: review.id,
      requesterIdentityId: request.identityId,
      helperIdentityId: review.subjectIdentityId,
      createdByIdentityId: identity.id,
      status: 'draft',
      context: safeIntroductionContext(review.id),
    },
    supabase,
  );

  await enqueueIntroductionCoordinationNotifications(
    { introduction, requestHeadline: request.headline, createdAt: options.now },
    supabase,
  );

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'introduction.created',
      actor: { type: 'user', id: identity.id },
      target: { type: 'introduction', id: introduction.id },
      metadata: {
        requestId: introduction.requestId,
        matchId: introduction.matchId,
        stewardReviewId: introduction.stewardReviewId,
        requesterIdentityId: introduction.requesterIdentityId,
        helperIdentityId: introduction.helperIdentityId,
        status: introduction.status,
      },
      occurredAt: options.now,
    }),
  );

  return { ok: true, introduction };
}
