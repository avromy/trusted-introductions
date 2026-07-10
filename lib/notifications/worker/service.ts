import { claimPendingNotifications, markNotificationFailed, markNotificationSent, type NotificationOutboxRepositoryClient } from '@/lib/notifications/outbox';
import { deliverWithSafeLogging, type NotificationDeliveryProvider } from '@/lib/notifications/providers';
import { calculateRetryDecision } from '@/lib/notifications/retry';

export type NotificationWorkerResult = {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
};

function readPayload(payload: unknown): { subject: string; textBody: string; htmlBody?: string } {
  if (!payload || typeof payload !== 'object') throw new Error('Notification template payload is invalid.');
  const value = payload as Record<string, unknown>;
  if (typeof value.subject !== 'string' || typeof value.textBody !== 'string') {
    throw new Error('Notification template payload is missing required content.');
  }
  return {
    subject: value.subject,
    textBody: value.textBody,
    ...(typeof value.htmlBody === 'string' ? { htmlBody: value.htmlBody } : {}),
  };
}

export async function runNotificationWorker(input: {
  repository: NotificationOutboxRepositoryClient;
  provider: NotificationDeliveryProvider;
  resolveDestination: (destinationRef: string) => Promise<string>;
  batchSize?: number;
  now?: Date;
}): Promise<NotificationWorkerResult> {
  const batchSize = Math.max(1, Math.min(input.batchSize ?? 25, 100));
  const now = input.now ?? new Date();
  const records = await claimPendingNotifications(batchSize, now, input.repository);
  const result: NotificationWorkerResult = { claimed: records.length, sent: 0, retried: 0, failed: 0 };

  for (const record of records) {
    try {
      const payload = readPayload(record.templatePayload);
      const destination = await input.resolveDestination(record.destinationRef);
      const delivery = await deliverWithSafeLogging(input.provider, {
        channel: 'email',
        to: destination,
        ...payload,
        providerMetadata: { outboxId: record.id, category: record.category },
      });

      if (delivery.status === 'success') {
        await markNotificationSent(record.id, now, input.repository);
        result.sent += 1;
        continue;
      }

      const decision = calculateRetryDecision({
        attemptCount: record.attemptCount,
        failure: delivery.status === 'transient_failure' ? 'transient' : 'permanent',
        now,
      });
      if (decision.action === 'retry') {
        await markNotificationFailed(record.id, 'transient', decision.nextAttemptAt, input.repository);
        result.retried += 1;
      } else {
        await markNotificationFailed(record.id, 'permanent', now, input.repository);
        result.failed += 1;
      }
    } catch (error) {
      const permanent = error instanceof Error && /invalid|unavailable/.test(error.message);
      await markNotificationFailed(record.id, permanent ? 'permanent' : 'unknown', now, input.repository);
      result.failed += 1;
    }
  }

  return result;
}
