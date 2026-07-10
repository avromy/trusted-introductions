export type NotificationOutboxStatus = 'pending' | 'processing' | 'sent' | 'failed';
export type NotificationFailureCategory = 'transient' | 'permanent';

export type NotificationOutboxRecord = {
  id: string;
  status: NotificationOutboxStatus;
  channel: string;
  provider: string;
  destination: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
  locked_by: string | null;
  locked_at: string | null;
  last_error_category: NotificationFailureCategory | null;
  last_error_code: string | null;
  next_attempt_at: string | null;
};

export type ClaimedNotificationOutboxRecord = NotificationOutboxRecord & {
  status: 'processing';
  locked_by: string;
  locked_at: string;
};

export type NotificationDeliveryMessage = Pick<
  ClaimedNotificationOutboxRecord,
  'id' | 'channel' | 'provider' | 'destination' | 'payload'
>;

export type NotificationDeliveryResult =
  | { ok: true; providerMessageId?: string }
  | { ok: false; category: NotificationFailureCategory; code: string };

export type NotificationProvider = {
  deliver(message: NotificationDeliveryMessage): Promise<NotificationDeliveryResult>;
};

export type NotificationOutboxStore = {
  claimPendingBatch(input: { limit: number; workerId: string; now: Date }): Promise<ClaimedNotificationOutboxRecord[]>;
  markSent(input: { id: string; workerId: string; now: Date; providerMessageId?: string }): Promise<boolean>;
  markFailed(input: {
    id: string;
    workerId: string;
    now: Date;
    attempts: number;
    category: NotificationFailureCategory;
    code: string;
    nextAttemptAt: Date | null;
  }): Promise<boolean>;
};
