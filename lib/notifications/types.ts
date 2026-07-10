export const NOTIFICATION_CATEGORY_VALUES = [
  'invite_delivery',
  'introduction_coordination',
  'follow_up_reminder',
  'outcome_prompt',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORY_VALUES)[number];

export type NotificationRecipient =
  | {
      type: 'identity';
      identityId: string;
      displayName?: string;
    }
  | {
      type: 'delivery_address_ref';
      addressRef: string;
      displayName?: string;
    };

export type NotificationMetadataValue = string | number | boolean | null;

export type NotificationMetadata = Record<string, NotificationMetadataValue>;

export interface NotificationMessage<
  TCategory extends NotificationCategory = NotificationCategory,
> {
  category: TCategory;
  recipient: NotificationRecipient;
  subject: string;
  textBody: string;
  htmlBody?: string;
  metadata: NotificationMetadata;
  idempotencyKey: string;
}

export interface InviteDeliveryTemplateInput {
  inviteId: string;
  recipient: NotificationRecipient;
  inviterDisplayName?: string;
  communityName?: string;
  acceptUrl: string;
}

export interface IntroductionCoordinationTemplateInput {
  introductionId: string;
  recipient: NotificationRecipient;
  coordinatorDisplayName?: string;
  counterpartDisplayName?: string;
  introductionUrl: string;
}

export interface FollowUpReminderTemplateInput {
  introductionId: string;
  reminderId: string;
  recipient: NotificationRecipient;
  introductionUrl: string;
  dueAt?: string;
}

export interface OutcomePromptTemplateInput {
  introductionId: string;
  promptId: string;
  recipient: NotificationRecipient;
  outcomeUrl: string;
}
