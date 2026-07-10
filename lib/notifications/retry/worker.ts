import {
  buildFailureRecord,
  type NotificationOutboxRetryState,
  type NotificationProviderResult,
  type NotificationRetryPolicy,
} from './policy';

export interface NotificationWorkerUpdate {
  status: 'sent' | 'retry_scheduled' | 'dead_letter';
  attemptCount: number;
  providerMessageId?: string | null;
  nextAttemptAt: string | null;
  failureKind: string | null;
  failureStatusCode: number | null;
  metadata: Record<string, unknown>;
}

export function applyNotificationProviderResult(
  outbox: NotificationOutboxRetryState,
  result: NotificationProviderResult,
  options: { now?: Date; policy?: NotificationRetryPolicy } = {},
): NotificationWorkerUpdate {
  if (result.ok) {
    return {
      status: 'sent',
      attemptCount: outbox.attemptCount + 1,
      providerMessageId: result.providerMessageId ?? null,
      nextAttemptAt: null,
      failureKind: null,
      failureStatusCode: null,
      metadata: {
        ...(outbox.metadata ?? {}),
        deliveredAt: (options.now ?? new Date()).toISOString(),
      },
    };
  }

  const failure = buildFailureRecord(outbox, result, options);

  return {
    status: failure.status,
    attemptCount: failure.attemptCount,
    nextAttemptAt: failure.nextAttemptAt,
    failureKind: failure.failureKind,
    failureStatusCode: failure.failureStatusCode,
    metadata: failure.metadata,
  };
}
