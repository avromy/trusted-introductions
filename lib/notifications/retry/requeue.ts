import type { NotificationOutboxRetryState } from './policy';

export type NotificationRequeueRole = 'member' | 'steward' | 'admin' | 'system';

export interface NotificationRequeueActor {
  identityId: string;
  role: NotificationRequeueRole;
  serverSide: boolean;
}

export interface NotificationRequeueResult extends NotificationOutboxRetryState {
  nextAttemptAt: string | null;
}

export function assertCanRequeueNotification(actor: NotificationRequeueActor): void {
  if (!actor.serverSide || (actor.role !== 'admin' && actor.role !== 'system')) {
    throw new Error('Notification requeue requires authorized server-side operator access.');
  }
}

export function requeueDeadLetterNotification(
  outbox: NotificationOutboxRetryState,
  actor: NotificationRequeueActor,
  options: { now?: Date; reason?: string } = {},
): NotificationRequeueResult {
  assertCanRequeueNotification(actor);

  if (outbox.status !== 'dead_letter') {
    throw new Error('Only dead-letter notification records can be requeued.');
  }

  const now = options.now ?? new Date();
  const previousHistory = Array.isArray(outbox.metadata?.requeueHistory)
    ? outbox.metadata.requeueHistory
    : [];

  return {
    ...outbox,
    status: 'pending',
    attemptCount: 0,
    nextAttemptAt: null,
    metadata: {
      ...(outbox.metadata ?? {}),
      requeuedAt: now.toISOString(),
      requeuedBy: actor.identityId,
      requeueHistory: [
        ...previousHistory,
        {
          at: now.toISOString(),
          by: actor.identityId,
          reason: options.reason?.trim() || 'operator_requeue',
          previousAttemptCount: outbox.attemptCount,
        },
      ],
    },
  };
}
