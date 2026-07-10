import { hashUnsubscribeToken, isOptionalNotificationCategory, type OptionalNotificationCategory } from '@/lib/notifications/preferences';

export type NotificationPreferenceClient = {
  from(table: 'notification_preferences'): {
    select(columns: string): { eq(column: string, value: string): Promise<{ data: Array<{ category: string; enabled: boolean }> | null; error: { message?: string } | null }> };
    upsert(payload: unknown, options?: unknown): Promise<{ error: { message?: string } | null }>;
    update(payload: unknown): { eq(column: string, value: string): { eq(column: string, value: string): Promise<{ error: { message?: string } | null }> } };
  };
};

export async function readNotificationPreferences(client: NotificationPreferenceClient, identityId: string) {
  const { data, error } = await client.from('notification_preferences').select('category,enabled').eq('identity_id', identityId);
  if (error) throw new Error(`Failed to read notification preferences: ${error.message ?? 'unknown error'}`);
  return data ?? [];
}

export async function setOptionalNotificationPreference(
  client: NotificationPreferenceClient,
  input: { identityId: string; category: OptionalNotificationCategory; enabled: boolean },
): Promise<void> {
  const { error } = await client.from('notification_preferences').upsert(
    { identity_id: input.identityId, category: input.category, enabled: input.enabled },
    { onConflict: 'identity_id,category' },
  );
  if (error) throw new Error(`Failed to update notification preference: ${error.message ?? 'unknown error'}`);
}

export function notificationAllowed(input: { category: string; explicitPreference?: boolean; unsubscribed?: boolean }): boolean {
  if (!isOptionalNotificationCategory(input.category)) return true;
  if (input.unsubscribed) return false;
  return input.explicitPreference === true;
}

export function verifyUnsubscribeToken(plaintextToken: string, persistedHash: string): boolean {
  return hashUnsubscribeToken(plaintextToken) === persistedHash;
}
