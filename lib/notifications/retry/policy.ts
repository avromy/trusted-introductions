export const NOTIFICATION_OUTBOX_STATUSES = [
  'pending',
  'processing',
  'sent',
  'retry_scheduled',
  'dead_letter',
] as const;

export type NotificationOutboxStatus = (typeof NOTIFICATION_OUTBOX_STATUSES)[number];

export type NotificationFailureKind =
  | 'none'
  | 'transient_provider'
  | 'rate_limited'
  | 'permanent_provider'
  | 'configuration'
  | 'unknown';

export type NotificationProviderResult =
  | { ok: true; providerMessageId?: string | null }
  | {
      ok: false;
      retryable: boolean;
      statusCode?: number | null;
      failureKind?: NotificationFailureKind;
      responseText?: string | null;
    };

export interface NotificationRetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMs?: (input: { attempt: number; outboxId: string }) => number;
}

export const DEFAULT_NOTIFICATION_RETRY_POLICY: NotificationRetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 60_000,
  maxDelayMs: 60 * 60_000,
};

export interface NotificationOutboxRetryState {
  id: string;
  status: NotificationOutboxStatus;
  attemptCount: number;
  metadata?: Record<string, unknown> | null;
}

export interface NotificationFailureRecord {
  status: Extract<NotificationOutboxStatus, 'retry_scheduled' | 'dead_letter'>;
  attemptCount: number;
  nextAttemptAt: string | null;
  failureKind: NotificationFailureKind;
  failureStatusCode: number | null;
  metadata: Record<string, unknown>;
}

export function classifyProviderFailure(result: NotificationProviderResult): NotificationFailureKind {
  if (result.ok) return 'none';
  if (result.failureKind) return result.failureKind;
  if (result.statusCode === 429) return 'rate_limited';
  if (result.statusCode && result.statusCode >= 400 && result.statusCode < 500) {
    return result.retryable ? 'transient_provider' : 'permanent_provider';
  }
  return result.retryable ? 'transient_provider' : 'unknown';
}

export function calculateRetryDelayMs(
  attempt: number,
  policy: NotificationRetryPolicy = DEFAULT_NOTIFICATION_RETRY_POLICY,
  outboxId = '',
): number {
  if (attempt < 1) throw new Error('Attempt must be at least 1.');
  if (policy.maxAttempts < 1) throw new Error('Retry policy must allow at least one attempt.');

  const exponentialDelay = policy.baseDelayMs * 2 ** (attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, policy.maxDelayMs);
  const jitter = policy.jitterMs?.({ attempt, outboxId }) ?? 0;

  return Math.max(0, Math.min(cappedDelay + jitter, policy.maxDelayMs));
}

export function buildFailureRecord(
  outbox: NotificationOutboxRetryState,
  result: Exclude<NotificationProviderResult, { ok: true }>,
  options: { now?: Date; policy?: NotificationRetryPolicy } = {},
): NotificationFailureRecord {
  const policy = options.policy ?? DEFAULT_NOTIFICATION_RETRY_POLICY;
  const now = options.now ?? new Date();
  const nextAttemptCount = outbox.attemptCount + 1;
  const failureKind = classifyProviderFailure(result);
  const exhausted = nextAttemptCount >= policy.maxAttempts;
  const deadLetter = !result.retryable || exhausted;
  const delayMs = calculateRetryDelayMs(nextAttemptCount, policy, outbox.id);
  const previousHistory = Array.isArray(outbox.metadata?.failureHistory)
    ? outbox.metadata.failureHistory
    : [];

  return {
    status: deadLetter ? 'dead_letter' : 'retry_scheduled',
    attemptCount: nextAttemptCount,
    nextAttemptAt: deadLetter ? null : new Date(now.getTime() + delayMs).toISOString(),
    failureKind,
    failureStatusCode: result.statusCode ?? null,
    metadata: {
      ...(outbox.metadata ?? {}),
      failureKind,
      failureStatusCode: result.statusCode ?? null,
      lastFailedAt: now.toISOString(),
      failureHistory: [
        ...previousHistory,
        {
          attempt: nextAttemptCount,
          at: now.toISOString(),
          failureKind,
          statusCode: result.statusCode ?? null,
          terminal: deadLetter,
        },
      ],
    },
  };
}
