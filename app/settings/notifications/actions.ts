'use server';

import {
  saveNotificationPreferencesAction as saveNotificationPreferences,
  type NotificationSettingsFormState,
} from '@/lib/notifications/preferences/actions';

export type { NotificationSettingsFormState };

export async function saveNotificationPreferencesAction(
  state: NotificationSettingsFormState,
  formData: FormData,
): Promise<NotificationSettingsFormState> {
  return saveNotificationPreferences(state, formData);
}
