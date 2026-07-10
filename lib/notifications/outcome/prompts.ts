import type { Introduction, IntroductionRow } from '@/lib/introductions/repository';
import type { IntroductionOutcome } from '@/lib/introductions/outcomes';
import type { Json } from '@/types/supabase';

export const OUTCOME_PROMPT_NOTIFICATION_TYPE = 'introduction_outcome_prompt.request_status_update' as const;
export const OUTCOME_PROMPT_ELIGIBLE_STATUSES = ['ready'] as const satisfies readonly IntroductionRow['status'][];
export const TERMINAL_INTRODUCTION_OUTCOMES = [
  'connected',
  'opportunity_created',
  'not_a_fit',
  'no_response',
] as const satisfies readonly IntroductionOutcome[];

export type OutcomePromptRecipientRole = 'requester' | 'helper' | 'steward';

export interface OutcomePromptPolicy {
  elapsedMs: number;
  occurrenceKey: string;
  recipientRoles: readonly OutcomePromptRecipientRole[];
}

export interface OutcomePromptRecipient {
  identityId: string;
  role: OutcomePromptRecipientRole;
}

export interface OutcomePromptExistingOutcome {
  outcome: IntroductionOutcome;
}

export interface OutcomePromptQueuedOccurrence {
  introductionId: string;
  recipientIdentityId: string;
  occurrenceKey: string;
  notificationType?: string;
}

export interface OutcomePromptOutboxMessage {
  type: typeof OUTCOME_PROMPT_NOTIFICATION_TYPE;
  idempotencyKey: string;
  recipientIdentityId: string;
  introductionId: string;
  occurrenceKey: string;
  template: {
    subject: string;
    body: string;
  };
  metadata: Record<string, Json>;
  queuedAt: string;
}

export interface OrchestrateOutcomePromptInput {
  introduction: Pick<
    Introduction,
    | 'id'
    | 'requesterIdentityId'
    | 'helperIdentityId'
    | 'createdByIdentityId'
    | 'status'
    | 'createdAt'
  >;
  policy: OutcomePromptPolicy;
  now?: Date | string;
  outcomes?: OutcomePromptExistingOutcome[];
  queuedPrompts?: OutcomePromptQueuedOccurrence[];
  recipients?: OutcomePromptRecipient[];
}

export interface OrchestrateOutcomePromptResult {
  queued: OutcomePromptOutboxMessage[];
  skipped: Array<{
    recipientIdentityId?: string;
    reason: 'terminal_outcome' | 'not_elapsed' | 'ineligible_introduction' | 'unauthorized_recipient' | 'already_queued';
  }>;
}

function normalizeDate(value: Date | string, fieldName: string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${fieldName} must be a valid date.`);
  return date;
}

function assertNonEmpty(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${fieldName} is required.`);
  return normalized;
}

export function buildOutcomePromptRecipients(
  introduction: Pick<Introduction, 'requesterIdentityId' | 'helperIdentityId' | 'createdByIdentityId'>,
  recipientRoles: readonly OutcomePromptRecipientRole[],
): OutcomePromptRecipient[] {
  const byIdentity = new Map<string, OutcomePromptRecipient>();

  recipientRoles.forEach((role) => {
    const identityId =
      role === 'requester'
        ? introduction.requesterIdentityId
        : role === 'helper'
          ? introduction.helperIdentityId
          : introduction.createdByIdentityId;
    const normalized = identityId.trim();
    if (!normalized || byIdentity.has(normalized)) return;
    byIdentity.set(normalized, { identityId: normalized, role });
  });

  return [...byIdentity.values()];
}

function isAuthorizedOutcomePromptRecipient(
  introduction: Pick<Introduction, 'requesterIdentityId' | 'helperIdentityId' | 'createdByIdentityId'>,
  recipient: OutcomePromptRecipient,
): boolean {
  return [
    introduction.requesterIdentityId.trim(),
    introduction.helperIdentityId.trim(),
    introduction.createdByIdentityId.trim(),
  ].includes(recipient.identityId.trim());
}

function buildIdempotencyKey(introductionId: string, recipientIdentityId: string, occurrenceKey: string): string {
  return [OUTCOME_PROMPT_NOTIFICATION_TYPE, introductionId, recipientIdentityId, occurrenceKey].join(':');
}

export function hasTerminalIntroductionOutcome(outcomes: OutcomePromptExistingOutcome[] = []): boolean {
  return outcomes.some(({ outcome }) =>
    TERMINAL_INTRODUCTION_OUTCOMES.includes(outcome as (typeof TERMINAL_INTRODUCTION_OUTCOMES)[number]),
  );
}

export function renderOutcomePromptTemplate(): OutcomePromptOutboxMessage['template'] {
  return {
    subject: 'Quick status update requested',
    body: 'Please share a quick status update for this introduction when you have a moment.',
  };
}

export function orchestrateOutcomePromptNotifications(
  input: OrchestrateOutcomePromptInput,
): OrchestrateOutcomePromptResult {
  const introductionId = assertNonEmpty(input.introduction.id, 'Introduction id');
  const occurrenceKey = assertNonEmpty(input.policy.occurrenceKey, 'Occurrence key');
  const now = input.now ? normalizeDate(input.now, 'Now') : new Date();
  const createdAt = normalizeDate(input.introduction.createdAt, 'Introduction created at');

  if (hasTerminalIntroductionOutcome(input.outcomes)) {
    return { queued: [], skipped: [{ reason: 'terminal_outcome' }] };
  }

  if (!OUTCOME_PROMPT_ELIGIBLE_STATUSES.includes(input.introduction.status as 'ready')) {
    return { queued: [], skipped: [{ reason: 'ineligible_introduction' }] };
  }

  if (now.getTime() - createdAt.getTime() < input.policy.elapsedMs) {
    return { queued: [], skipped: [{ reason: 'not_elapsed' }] };
  }

  const queued: OutcomePromptOutboxMessage[] = [];
  const skipped: OrchestrateOutcomePromptResult['skipped'] = [];
  const existingKeys = new Set(
    (input.queuedPrompts ?? []).map((prompt) =>
      buildIdempotencyKey(prompt.introductionId, prompt.recipientIdentityId, prompt.occurrenceKey),
    ),
  );

  const recipients = input.recipients ??
    buildOutcomePromptRecipients(input.introduction, input.policy.recipientRoles);

  recipients.forEach((recipient) => {
    if (!isAuthorizedOutcomePromptRecipient(input.introduction, recipient)) {
      skipped.push({ recipientIdentityId: recipient.identityId, reason: 'unauthorized_recipient' });
      return;
    }

    const idempotencyKey = buildIdempotencyKey(introductionId, recipient.identityId, occurrenceKey);
    if (existingKeys.has(idempotencyKey)) {
      skipped.push({ recipientIdentityId: recipient.identityId, reason: 'already_queued' });
      return;
    }

    existingKeys.add(idempotencyKey);
    queued.push({
      type: OUTCOME_PROMPT_NOTIFICATION_TYPE,
      idempotencyKey,
      recipientIdentityId: recipient.identityId,
      introductionId,
      occurrenceKey,
      template: renderOutcomePromptTemplate(),
      queuedAt: now.toISOString(),
      metadata: {
        introductionId,
        occurrenceKey,
        recipientRole: recipient.role,
        promptElapsedMs: input.policy.elapsedMs,
      },
    });
  });

  return { queued, skipped };
}
