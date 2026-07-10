import { logStructuredEvent, type StructuredLogEvent } from '@/lib/observability/logger';
import { getNotificationProvider } from '../provider';
import { SupabaseNotificationOutboxStore } from './repository';
import type { NotificationOutboxStore, NotificationProvider } from './types';

export const DEFAULT_NOTIFICATION_WORKER_BATCH_SIZE = 25;
export const DEFAULT_NOTIFICATION_WORKER_MAX_DURATION_MS = 25_000;
export const MAX_NOTIFICATION_WORKER_BATCH_SIZE = 100;

export type NotificationWorkerPassResult = {
  workerId: string;
  claimed: number;
  delivered: number;
  transientFailures: number;
  permanentFailures: number;
  skippedByBoundary: number;
  durationMs: number;
};

type LogSink = (entry: StructuredLogEvent) => void;

export type RunNotificationWorkerPassOptions = {
  store?: NotificationOutboxStore;
  provider?: NotificationProvider;
  workerId?: string;
  batchSize?: number;
  maxDurationMs?: number;
  now?: () => Date;
  logSink?: LogSink;
};

export async function runNotificationWorkerPass(options: RunNotificationWorkerPassOptions = {}): Promise<NotificationWorkerPassResult> {
  const startedAt = options.now?.() ?? new Date();
  const now = options.now ?? (() => new Date());
  const workerId = options.workerId ?? `notification-worker-${crypto.randomUUID()}`;
  const batchSize = clampBatchSize(options.batchSize ?? (Number(process.env.NOTIFICATION_WORKER_BATCH_SIZE) || DEFAULT_NOTIFICATION_WORKER_BATCH_SIZE));
  const maxDurationMs = clampDuration(options.maxDurationMs ?? (Number(process.env.NOTIFICATION_WORKER_MAX_DURATION_MS) || DEFAULT_NOTIFICATION_WORKER_MAX_DURATION_MS));
  const store = options.store ?? new SupabaseNotificationOutboxStore();
  const provider = options.provider ?? getNotificationProvider();

  logWorkerEvent('notification_worker.started', { workerId, batchSize, maxDurationMs }, options.logSink);

  const claimed = await store.claimPendingBatch({ limit: batchSize, workerId, now: startedAt });
  let delivered = 0;
  let transientFailures = 0;
  let permanentFailures = 0;
  let skippedByBoundary = 0;

  for (const record of claimed) {
    if (now().getTime() - startedAt.getTime() >= maxDurationMs) {
      skippedByBoundary += 1;
      continue;
    }

    const delivery = await provider.deliver({
      id: record.id,
      channel: record.channel,
      provider: record.provider,
      destination: record.destination,
      payload: record.payload,
    });
    const completedAt = now();

    if (delivery.ok) {
      const marked = await store.markSent({ id: record.id, workerId, now: completedAt, providerMessageId: delivery.providerMessageId });
      if (marked) delivered += 1;
      logWorkerEvent('notification_worker.record_delivered', { workerId, recordId: record.id, status: marked ? 'sent' : 'stale_claim' }, options.logSink);
      continue;
    }

    const attempts = record.attempts + 1;
    const exhausted = attempts >= record.max_attempts;
    const category = exhausted ? 'permanent' : delivery.category;
    const nextAttemptAt = category === 'transient' ? new Date(completedAt.getTime() + retryDelayMs(attempts)) : null;
    const marked = await store.markFailed({
      id: record.id,
      workerId,
      now: completedAt,
      attempts,
      category,
      code: delivery.code,
      nextAttemptAt,
    });

    if (marked && category === 'transient') transientFailures += 1;
    if (marked && category === 'permanent') permanentFailures += 1;
    logWorkerEvent('notification_worker.record_failed', { workerId, recordId: record.id, category, status: marked ? 'updated' : 'stale_claim', code: delivery.code }, options.logSink);
  }

  const result = {
    workerId,
    claimed: claimed.length,
    delivered,
    transientFailures,
    permanentFailures,
    skippedByBoundary,
    durationMs: Math.max(0, now().getTime() - startedAt.getTime()),
  };
  logWorkerEvent('notification_worker.completed', result, options.logSink);
  return result;
}

function clampBatchSize(value: number): number {
  if (!Number.isFinite(value) || value < 1) return DEFAULT_NOTIFICATION_WORKER_BATCH_SIZE;
  return Math.min(Math.floor(value), MAX_NOTIFICATION_WORKER_BATCH_SIZE);
}

function clampDuration(value: number): number {
  if (!Number.isFinite(value) || value < 1_000) return DEFAULT_NOTIFICATION_WORKER_MAX_DURATION_MS;
  return Math.min(Math.floor(value), 60_000);
}

function retryDelayMs(attempts: number): number {
  return Math.min(60 * 60 * 1000, 2 ** Math.max(0, attempts - 1) * 60_000);
}

function logWorkerEvent(event: string, metadata: Record<string, unknown>, logSink?: LogSink): void {
  logStructuredEvent({ event, metadata }, logSink);
}
