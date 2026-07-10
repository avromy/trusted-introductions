export const NOTIFICATION_PREFERENCE_CATEGORIES = [
  'operational_invites',
  'introduction_coordination',
  'follow_up_reminders',
  'outcome_prompts',
] as const;

export type NotificationPreferenceCategory = (typeof NOTIFICATION_PREFERENCE_CATEGORIES)[number];

export const OPTIONAL_NOTIFICATION_CATEGORIES = [
  'follow_up_reminders',
  'outcome_prompts',
] as const satisfies readonly NotificationPreferenceCategory[];

export type OptionalNotificationCategory = (typeof OPTIONAL_NOTIFICATION_CATEGORIES)[number];

export const REQUIRED_NOTIFICATION_CATEGORIES = [
  'operational_invites',
  'introduction_coordination',
] as const satisfies readonly NotificationPreferenceCategory[];

export type RequiredNotificationCategory = (typeof REQUIRED_NOTIFICATION_CATEGORIES)[number];

export type NotificationPreferences = Record<NotificationPreferenceCategory, boolean>;

export type NotificationUnsubscribeScope = OptionalNotificationCategory | 'all_optional';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  operational_invites: true,
  introduction_coordination: true,
  follow_up_reminders: false,
  outcome_prompts: false,
};

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationPreferenceCategory, string> = {
  operational_invites: 'Operational invite messages',
  introduction_coordination: 'Introduction coordination',
  follow_up_reminders: 'Follow-up reminders',
  outcome_prompts: 'Outcome prompts',
};

export function isNotificationPreferenceCategory(
  value: unknown,
): value is NotificationPreferenceCategory {
  return (
    typeof value === 'string' &&
    (NOTIFICATION_PREFERENCE_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isOptionalNotificationCategory(
  value: unknown,
): value is OptionalNotificationCategory {
  return typeof value === 'string' && (OPTIONAL_NOTIFICATION_CATEGORIES as readonly string[]).includes(value);
}

export function isUnsubscribeScope(value: unknown): value is NotificationUnsubscribeScope {
  return value === 'all_optional' || isOptionalNotificationCategory(value);
}
