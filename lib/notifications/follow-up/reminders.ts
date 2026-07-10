import type { Introduction } from '@/lib/introductions/repository';
import type { Json } from '@/types/supabase';

export type FollowUpReminderStatus = 'scheduled' | 'queued' | 'sent' | 'completed' | 'canceled';

export interface PersistedFollowUpReminderOccurrence {
  id: string;
  introductionId: string;
  stewardIdentityId: string;
  remindAt: string;
  recipientIdentityIds: string[];
  status: FollowUpReminderStatus;
  createdAt: string;
  queuedAt?: string | null;
}

export interface FollowUpReminderNotification {
  idempotency_key: string;
  template: 'introduction_follow_up_reminder';
  channel: 'email';
  recipient_identity_id: string;
  subject_table: 'introductions';
  subject_id: string;
  scheduled_for: string;
  payload: Record<string, Json>;
  provider_metadata: Record<string, Json>;
}

export interface FollowUpReminderOutboxClient {
  from(table: 'notification_outbox'): {
    insert(payload: FollowUpReminderNotification | FollowUpReminderNotification[]): Promise<{ error: Error | null }>;
  };
}

export interface FollowUpReminderAuditClient {
  from(table: 'audit_events'): {
    insert(payload: {
      event_type: string;
      actor_identity_id: string;
      subject_table: 'introductions';
      subject_id: string;
      metadata: Record<string, Json>;
      occurred_at: string;
    }): Promise<{ error: Error | null }>;
  };
}

export function canAccessFollowUpReminder(
  identity: { id: string; roles: Array<{ role: 'member' | 'steward' | 'admin'; community_id: string | null }> },
  introduction: Pick<Introduction, 'requesterIdentityId' | 'helperIdentityId' | 'createdByIdentityId'>,
): boolean {
  return (
    identity.roles.some((role) => role.role === 'steward' || role.role === 'admin') ||
    introduction.requesterIdentityId === identity.id ||
    introduction.helperIdentityId === identity.id ||
    introduction.createdByIdentityId === identity.id
  );
}

function assertAuthorizedReminderRecipient(
  recipientIdentityId: string,
  introduction: Pick<Introduction, 'requesterIdentityId' | 'helperIdentityId' | 'createdByIdentityId'>,
): void {
  const allowed = new Set([
    introduction.requesterIdentityId,
    introduction.helperIdentityId,
    introduction.createdByIdentityId,
  ]);

  if (!allowed.has(recipientIdentityId)) {
    throw new Error('Reminder recipient is not part of the trusted introduction relationship.');
  }
}

export function identifyDueFollowUpReminder(
  reminder: PersistedFollowUpReminderOccurrence,
  options: { now?: Date | string } = {},
): PersistedFollowUpReminderOccurrence | null {
  const now = options.now ? new Date(options.now).getTime() : Date.now();
  const remindAt = new Date(reminder.remindAt).getTime();

  if (Number.isNaN(remindAt)) throw new Error('Reminder time must be a valid date.');
  if (reminder.status !== 'scheduled') return null;
  if (remindAt > now) return null;

  return reminder;
}

export function buildSafeFollowUpReminderNotification(input: {
  reminder: PersistedFollowUpReminderOccurrence;
  introduction: Pick<Introduction, 'id' | 'requesterIdentityId' | 'helperIdentityId' | 'createdByIdentityId'>;
  recipientIdentityId: string;
}): FollowUpReminderNotification {
  assertAuthorizedReminderRecipient(input.recipientIdentityId, input.introduction);

  return {
    idempotency_key: `introduction-follow-up-reminder:${input.reminder.id}:${input.recipientIdentityId}`,
    template: 'introduction_follow_up_reminder',
    channel: 'email',
    recipient_identity_id: input.recipientIdentityId,
    subject_table: 'introductions',
    subject_id: input.introduction.id,
    scheduled_for: input.reminder.remindAt,
    payload: {
      introductionId: input.introduction.id,
      reminderId: input.reminder.id,
      remindAt: input.reminder.remindAt,
    },
    provider_metadata: {
      idempotencyKey: `introduction-follow-up-reminder:${input.reminder.id}:${input.recipientIdentityId}`,
      template: 'introduction_follow_up_reminder',
    },
  };
}

function isDuplicateOutboxError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return message.includes('duplicate') || message.includes('unique') || message.includes('conflict');
}

export async function enqueueFollowUpReminderNotification(
  client: FollowUpReminderOutboxClient,
  notification: FollowUpReminderNotification,
): Promise<{ queued: boolean; idempotencyKey: string }> {
  const { error } = await client.from('notification_outbox').insert(notification);

  if (error) {
    if (isDuplicateOutboxError(error)) {
      return { queued: false, idempotencyKey: notification.idempotency_key };
    }
    throw error;
  }

  return { queued: true, idempotencyKey: notification.idempotency_key };
}

export async function recordFollowUpReminderOccurrenceQueued(
  client: FollowUpReminderAuditClient,
  input: {
    reminder: PersistedFollowUpReminderOccurrence;
    actorIdentityId: string;
    queuedAt?: Date | string;
    idempotencyKeys: string[];
  },
): Promise<void> {
  const queuedAt = input.queuedAt ? new Date(input.queuedAt).toISOString() : new Date().toISOString();
  const { error } = await client.from('audit_events').insert({
    event_type: 'introduction_follow_up_reminder.queued',
    actor_identity_id: input.actorIdentityId,
    subject_table: 'introductions',
    subject_id: input.reminder.introductionId,
    occurred_at: queuedAt,
    metadata: {
      reminderId: input.reminder.id,
      remindAt: input.reminder.remindAt,
      recipientCount: input.reminder.recipientIdentityIds.length,
      idempotencyKeys: input.idempotencyKeys,
      status: 'queued',
    },
  });

  if (error) throw error;
}

export async function queueDueFollowUpReminderNotifications(
  clients: FollowUpReminderOutboxClient & FollowUpReminderAuditClient,
  input: {
    reminder: PersistedFollowUpReminderOccurrence;
    introduction: Pick<Introduction, 'id' | 'requesterIdentityId' | 'helperIdentityId' | 'createdByIdentityId'>;
    actorIdentity: { id: string; roles: Array<{ role: 'member' | 'steward' | 'admin'; community_id: string | null }> };
    now?: Date | string;
  },
): Promise<{ queued: number; suppressed: number; idempotencyKeys: string[] }> {
  if (!canAccessFollowUpReminder(input.actorIdentity, input.introduction)) {
    throw new Error('You are not authorized to perform this action.');
  }

  const due = identifyDueFollowUpReminder(input.reminder, { now: input.now });
  if (!due) return { queued: 0, suppressed: 0, idempotencyKeys: [] };

  let queued = 0;
  let suppressed = 0;
  const idempotencyKeys: string[] = [];

  for (const recipientIdentityId of due.recipientIdentityIds) {
    const notification = buildSafeFollowUpReminderNotification({
      reminder: due,
      introduction: input.introduction,
      recipientIdentityId,
    });
    const result = await enqueueFollowUpReminderNotification(clients, notification);
    idempotencyKeys.push(result.idempotencyKey);
    if (result.queued) queued += 1;
    else suppressed += 1;
  }

  if (queued > 0) {
    await recordFollowUpReminderOccurrenceQueued(clients, {
      reminder: due,
      actorIdentityId: input.actorIdentity.id,
      queuedAt: input.now,
      idempotencyKeys,
    });
  }

  return { queued, suppressed, idempotencyKeys };
}
