import { createHash, randomBytes } from 'node:crypto';

export const OPTIONAL_NOTIFICATION_CATEGORIES = ['follow_up_reminder', 'outcome_prompt'] as const;
export type OptionalNotificationCategory = (typeof OPTIONAL_NOTIFICATION_CATEGORIES)[number];

export function hashUnsubscribeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createUnsubscribeToken(): { plaintextToken: string; tokenHash: string } {
  const plaintextToken = randomBytes(32).toString('base64url');
  return { plaintextToken, tokenHash: hashUnsubscribeToken(plaintextToken) };
}

export function isOptionalNotificationCategory(value: string): value is OptionalNotificationCategory {
  return (OPTIONAL_NOTIFICATION_CATEGORIES as readonly string[]).includes(value);
}

export function defaultNotificationEnabled(category: string): boolean {
  return category === 'invite_delivery' || category === 'introduction_coordination';
}
