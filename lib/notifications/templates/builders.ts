import type {
  FollowUpReminderTemplateInput,
  IntroductionCoordinationTemplateInput,
  InviteDeliveryTemplateInput,
  NotificationCategory,
  NotificationMessage,
  NotificationMetadata,
  NotificationRecipient,
  OutcomePromptTemplateInput,
} from '@/lib/notifications/types';

function normalizeRequired(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function recipientKey(recipient: NotificationRecipient): string {
  return recipient.type === 'identity'
    ? `identity:${normalizeRequired(recipient.identityId, 'Recipient identity id')}`
    : `delivery_address_ref:${normalizeRequired(recipient.addressRef, 'Recipient delivery address reference')}`;
}

function displayName(recipient: NotificationRecipient): string {
  return recipient.displayName?.trim() || 'there';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function makeIdempotencyKey(
  category: NotificationCategory,
  subjectId: string,
  recipient: NotificationRecipient,
  suffix?: string,
): string {
  const parts = [
    'notification',
    category,
    normalizeRequired(subjectId, 'Subject id'),
    recipientKey(recipient),
  ];

  if (suffix) {
    parts.push(normalizeRequired(suffix, 'Idempotency suffix'));
  }

  return parts.join(':');
}

function makeHtmlBody(lines: string[]): string {
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
}

function buildMessage<TCategory extends NotificationCategory>(input: {
  category: TCategory;
  recipient: NotificationRecipient;
  subject: string;
  lines: string[];
  metadata: NotificationMetadata;
  idempotencyKey: string;
}): NotificationMessage<TCategory> {
  return {
    category: input.category,
    recipient: input.recipient,
    subject: normalizeRequired(input.subject, 'Notification subject'),
    textBody: input.lines.map((line) => line.trim()).join('\n\n'),
    htmlBody: makeHtmlBody(input.lines),
    metadata: input.metadata,
    idempotencyKey: input.idempotencyKey,
  };
}

export function buildInviteDeliveryNotification(
  input: InviteDeliveryTemplateInput,
): NotificationMessage<'invite_delivery'> {
  const inviteId = normalizeRequired(input.inviteId, 'Invite id');
  const acceptUrl = normalizeRequired(input.acceptUrl, 'Accept URL');
  const inviter = input.inviterDisplayName?.trim() || 'A trusted community member';
  const community = input.communityName?.trim() || 'Trusted Introductions';

  return buildMessage({
    category: 'invite_delivery',
    recipient: input.recipient,
    subject: `You're invited to ${community}`,
    lines: [
      `Hi ${displayName(input.recipient)},`,
      `${inviter} invited you to join ${community}.`,
      'Use the secure invite link below to review the invitation and choose whether to continue.',
      acceptUrl,
    ],
    metadata: {
      inviteId,
      template: 'invite_delivery_v1',
      hasInviterDisplayName: Boolean(input.inviterDisplayName?.trim()),
      hasCommunityName: Boolean(input.communityName?.trim()),
    },
    idempotencyKey: makeIdempotencyKey('invite_delivery', inviteId, input.recipient),
  });
}

export function buildIntroductionCoordinationNotification(
  input: IntroductionCoordinationTemplateInput,
): NotificationMessage<'introduction_coordination'> {
  const introductionId = normalizeRequired(input.introductionId, 'Introduction id');
  const introductionUrl = normalizeRequired(input.introductionUrl, 'Introduction URL');
  const coordinator = input.coordinatorDisplayName?.trim() || 'Your steward';
  const counterpart = input.counterpartDisplayName?.trim() || 'the other participant';

  return buildMessage({
    category: 'introduction_coordination',
    recipient: input.recipient,
    subject: 'Introduction coordination update',
    lines: [
      `Hi ${displayName(input.recipient)},`,
      `${coordinator} is coordinating an introduction with ${counterpart}.`,
      'Please review the introduction details in Trusted Introductions and respond when you are ready.',
      introductionUrl,
    ],
    metadata: {
      introductionId,
      template: 'introduction_coordination_v1',
      hasCoordinatorDisplayName: Boolean(input.coordinatorDisplayName?.trim()),
      hasCounterpartDisplayName: Boolean(input.counterpartDisplayName?.trim()),
    },
    idempotencyKey: makeIdempotencyKey(
      'introduction_coordination',
      introductionId,
      input.recipient,
    ),
  });
}

export function buildFollowUpReminderNotification(
  input: FollowUpReminderTemplateInput,
): NotificationMessage<'follow_up_reminder'> {
  const introductionId = normalizeRequired(input.introductionId, 'Introduction id');
  const reminderId = normalizeRequired(input.reminderId, 'Reminder id');
  const introductionUrl = normalizeRequired(input.introductionUrl, 'Introduction URL');

  return buildMessage({
    category: 'follow_up_reminder',
    recipient: input.recipient,
    subject: 'Reminder to follow up on your introduction',
    lines: [
      `Hi ${displayName(input.recipient)},`,
      'This is a neutral reminder to follow up on an introduction in Trusted Introductions.',
      'Open the introduction to review the current status and decide on the next step.',
      introductionUrl,
    ],
    metadata: {
      introductionId,
      reminderId,
      template: 'follow_up_reminder_v1',
      dueAt: input.dueAt?.trim() || null,
    },
    idempotencyKey: makeIdempotencyKey(
      'follow_up_reminder',
      introductionId,
      input.recipient,
      reminderId,
    ),
  });
}

export function buildOutcomePromptNotification(
  input: OutcomePromptTemplateInput,
): NotificationMessage<'outcome_prompt'> {
  const introductionId = normalizeRequired(input.introductionId, 'Introduction id');
  const promptId = normalizeRequired(input.promptId, 'Prompt id');
  const outcomeUrl = normalizeRequired(input.outcomeUrl, 'Outcome URL');

  return buildMessage({
    category: 'outcome_prompt',
    recipient: input.recipient,
    subject: 'Share an outcome for your introduction',
    lines: [
      `Hi ${displayName(input.recipient)},`,
      'Please share a brief outcome update for an introduction in Trusted Introductions.',
      'Only include information appropriate for the platform record; do not add private notes or sensitive personal details.',
      outcomeUrl,
    ],
    metadata: {
      introductionId,
      promptId,
      template: 'outcome_prompt_v1',
    },
    idempotencyKey: makeIdempotencyKey('outcome_prompt', introductionId, input.recipient, promptId),
  });
}
