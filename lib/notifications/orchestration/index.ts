import { enqueueNotification, type NotificationOutboxRecord, type NotificationOutboxRepositoryClient } from '@/lib/notifications/outbox';
import {
  buildFollowUpReminderNotification,
  buildIntroductionCoordinationNotification,
  buildInviteDeliveryNotification,
  buildOutcomePromptNotification,
} from '@/lib/notifications/templates/builders';

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!email) throw new Error('Notification email destination is required.');
  return email;
}

function templatePayload(message: { subject: string; textBody: string; htmlBody?: string }): Record<string, string> {
  return {
    subject: message.subject,
    textBody: message.textBody,
    ...(message.htmlBody ? { htmlBody: message.htmlBody } : {}),
  };
}

export async function queueInviteDeliveryNotification(
  client: NotificationOutboxRepositoryClient,
  input: {
    inviteId: string;
    inviteeEmail: string;
    acceptUrl: string;
    inviterDisplayName?: string;
    communityName?: string;
    now?: Date;
  },
): Promise<NotificationOutboxRecord> {
  const email = normalizeEmail(input.inviteeEmail);
  const message = buildInviteDeliveryNotification({
    inviteId: input.inviteId,
    recipient: { type: 'delivery_address_ref', addressRef: email },
    acceptUrl: input.acceptUrl,
    inviterDisplayName: input.inviterDisplayName,
    communityName: input.communityName,
  });

  return enqueueNotification(
    {
      category: message.category,
      channel: 'email',
      destinationRef: email,
      templatePayload: templatePayload(message),
      metadata: { inviteId: input.inviteId, template: 'invite_delivery_v1' },
      idempotencyKey: `invite-delivery:${input.inviteId}:created`,
      nextAttemptAt: input.now,
    },
    client,
  );
}

export async function queueIntroductionCoordinationNotifications(
  client: NotificationOutboxRepositoryClient,
  input: {
    introductionId: string;
    requesterIdentityId: string;
    helperIdentityId: string;
    introductionUrl: string;
    now?: Date;
  },
): Promise<NotificationOutboxRecord[]> {
  const recipients = [
    { role: 'requester', identityId: input.requesterIdentityId },
    { role: 'helper', identityId: input.helperIdentityId },
  ] as const;

  const records: NotificationOutboxRecord[] = [];
  for (const recipient of recipients) {
    const message = buildIntroductionCoordinationNotification({
      introductionId: input.introductionId,
      recipient: { type: 'identity', identityId: recipient.identityId },
      counterpartDisplayName: 'the other participant',
      introductionUrl: input.introductionUrl,
    });
    records.push(
      await enqueueNotification(
        {
          category: message.category,
          recipientIdentityId: recipient.identityId,
          channel: 'email',
          destinationRef: `identity:${recipient.identityId}:primary_email`,
          templatePayload: templatePayload(message),
          metadata: {
            introductionId: input.introductionId,
            recipientRole: recipient.role,
            template: 'introduction_coordination_v1',
          },
          idempotencyKey: `introduction-coordination:${input.introductionId}:${recipient.role}`,
          nextAttemptAt: input.now,
        },
        client,
      ),
    );
  }
  return records;
}

export async function queueFollowUpReminderNotification(
  client: NotificationOutboxRepositoryClient,
  input: {
    introductionId: string;
    reminderId: string;
    recipientIdentityId: string;
    introductionUrl: string;
    dueAt: string;
  },
): Promise<NotificationOutboxRecord> {
  const message = buildFollowUpReminderNotification({
    introductionId: input.introductionId,
    reminderId: input.reminderId,
    recipient: { type: 'identity', identityId: input.recipientIdentityId },
    introductionUrl: input.introductionUrl,
    dueAt: input.dueAt,
  });
  return enqueueNotification(
    {
      category: message.category,
      recipientIdentityId: input.recipientIdentityId,
      channel: 'email',
      destinationRef: `identity:${input.recipientIdentityId}:primary_email`,
      templatePayload: templatePayload(message),
      metadata: {
        introductionId: input.introductionId,
        reminderId: input.reminderId,
        template: 'follow_up_reminder_v1',
      },
      idempotencyKey: `follow-up-reminder:${input.reminderId}:${input.recipientIdentityId}`,
      nextAttemptAt: input.dueAt,
    },
    client,
  );
}

export async function queueOutcomePromptNotification(
  client: NotificationOutboxRepositoryClient,
  input: {
    introductionId: string;
    promptId: string;
    recipientIdentityId: string;
    occurrenceKey: string;
    outcomeUrl: string;
    now?: Date;
  },
): Promise<NotificationOutboxRecord> {
  const message = buildOutcomePromptNotification({
    introductionId: input.introductionId,
    promptId: input.promptId,
    recipient: { type: 'identity', identityId: input.recipientIdentityId },
    outcomeUrl: input.outcomeUrl,
  });
  return enqueueNotification(
    {
      category: message.category,
      recipientIdentityId: input.recipientIdentityId,
      channel: 'email',
      destinationRef: `identity:${input.recipientIdentityId}:primary_email`,
      templatePayload: templatePayload(message),
      metadata: {
        introductionId: input.introductionId,
        promptId: input.promptId,
        occurrenceKey: input.occurrenceKey,
        template: 'outcome_prompt_v1',
      },
      idempotencyKey: `outcome-prompt:${input.introductionId}:${input.recipientIdentityId}:${input.occurrenceKey}`,
      nextAttemptAt: input.now,
    },
    client,
  );
}
