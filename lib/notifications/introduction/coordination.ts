import type { Json } from '@/types/supabase';
import type { Introduction } from '@/lib/introductions/repository';

export const INTRODUCTION_COORDINATION_NOTIFICATION_EVENT =
  'introduction_coordination_notification.enqueued';

export type IntroductionCoordinationRecipientRole = 'requester' | 'helper';

export interface IntroductionCoordinationNotification {
  introductionId: string;
  recipientIdentityId: string;
  recipientRole: IntroductionCoordinationRecipientRole;
  templateKey: 'introduction_coordination_requester' | 'introduction_coordination_helper';
  subject: string;
  body: string;
  payload: Json;
}

export interface IntroductionCoordinationContext {
  introduction: Introduction;
  requestHeadline?: string | null;
  createdAt?: Date;
}

type AuditEventRow = {
  id?: string;
  event_type?: string;
  subject_table?: string | null;
  subject_id?: string | null;
  metadata?: Json;
};

type QueryResult<T> = Promise<{ data: T; error: { message?: string } | Error | null }>;

type AuditEventQueryBuilder<T> = {
  select(columns?: string): AuditEventQueryBuilder<T>;
  insert(payload: unknown): AuditEventQueryBuilder<T> | QueryResult<unknown>;
  eq(column: string, value: unknown): AuditEventQueryBuilder<T>;
  maybeSingle(): QueryResult<T | null>;
};

export type IntroductionCoordinationNotificationOutboxClient = {
  from(table: 'audit_events'): AuditEventQueryBuilder<AuditEventRow>;
};

function throwNotificationOutboxError(
  operation: string,
  error: { message?: string } | Error,
): never {
  throw new Error(`Failed to ${operation}: ${error.message ?? 'unknown Supabase error'}`);
}

function normalizeHeadline(headline: string | null | undefined): string | null {
  const normalized = headline?.replace(/\s+/g, ' ').trim();
  return normalized ? normalized : null;
}

function buildSafePayload(
  introduction: Introduction,
  recipientRole: IntroductionCoordinationRecipientRole,
  requestHeadline?: string | null,
): Json {
  return {
    introductionId: introduction.id,
    requestId: introduction.requestId,
    matchId: introduction.matchId,
    stewardReviewId: introduction.stewardReviewId,
    requesterIdentityId: introduction.requesterIdentityId,
    helperIdentityId: introduction.helperIdentityId,
    recipientRole,
    requestHeadline: normalizeHeadline(requestHeadline),
    messageContentIncluded: false,
  };
}

export function buildIntroductionCoordinationNotifications({
  introduction,
  requestHeadline,
}: IntroductionCoordinationContext): IntroductionCoordinationNotification[] {
  const headline = normalizeHeadline(requestHeadline);
  const contextLine = headline ? ` Request context: ${headline}.` : '';

  return [
    {
      introductionId: introduction.id,
      recipientIdentityId: introduction.requesterIdentityId,
      recipientRole: 'requester',
      templateKey: 'introduction_coordination_requester',
      subject: 'Introduction coordination started',
      body: `An approved helper match is ready for coordination.${contextLine} Use the introduction thread to coordinate next steps.`,
      payload: buildSafePayload(introduction, 'requester', headline),
    },
    {
      introductionId: introduction.id,
      recipientIdentityId: introduction.helperIdentityId,
      recipientRole: 'helper',
      templateKey: 'introduction_coordination_helper',
      subject: 'Introduction coordination requested',
      body: `A steward-approved introduction is ready for coordination.${contextLine} Use the introduction thread to coordinate next steps.`,
      payload: buildSafePayload(introduction, 'helper', headline),
    },
  ];
}

async function notificationAlreadyEnqueued(
  client: IntroductionCoordinationNotificationOutboxClient,
  notification: IntroductionCoordinationNotification,
): Promise<boolean> {
  const { data, error } = await client
    .from('audit_events')
    .select('id')
    .eq('event_type', INTRODUCTION_COORDINATION_NOTIFICATION_EVENT)
    .eq('subject_table', 'introductions')
    .eq('subject_id', notification.introductionId)
    .eq('metadata->>recipientRole', notification.recipientRole)
    .maybeSingle();

  if (error)
    throwNotificationOutboxError('check introduction coordination notification outbox', error);
  return Boolean(data);
}

export async function enqueueIntroductionCoordinationNotifications(
  context: IntroductionCoordinationContext,
  client: IntroductionCoordinationNotificationOutboxClient,
): Promise<IntroductionCoordinationNotification[]> {
  const notifications = buildIntroductionCoordinationNotifications(context);
  const enqueued: IntroductionCoordinationNotification[] = [];
  const occurredAt = (context.createdAt ?? new Date()).toISOString();

  for (const notification of notifications) {
    if (await notificationAlreadyEnqueued(client, notification)) continue;

    const result = await client.from('audit_events').insert({
      event_type: INTRODUCTION_COORDINATION_NOTIFICATION_EVENT,
      actor_identity_id: context.introduction.createdByIdentityId,
      subject_table: 'introductions',
      subject_id: notification.introductionId,
      occurred_at: occurredAt,
      metadata: {
        templateKey: notification.templateKey,
        recipientIdentityId: notification.recipientIdentityId,
        recipientRole: notification.recipientRole,
        subject: notification.subject,
        body: notification.body,
        payload: notification.payload,
        deliveryStatus: 'pending',
        provider: null,
      },
    });

    const error = 'error' in result ? result.error : null;
    if (error)
      throwNotificationOutboxError('enqueue introduction coordination notification', error);
    enqueued.push(notification);
  }

  return enqueued;
}
