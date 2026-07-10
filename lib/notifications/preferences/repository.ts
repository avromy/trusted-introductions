import type { Database } from '@/types/supabase';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  OPTIONAL_NOTIFICATION_CATEGORIES,
  type NotificationPreferences,
  type NotificationPreferenceCategory,
  type NotificationUnsubscribeScope,
} from './types';

export type NotificationPreferenceRow = Database['public']['Tables']['notification_preferences']['Row'];
export type NotificationUnsubscribeRow = Database['public']['Tables']['notification_unsubscribes']['Row'];

export type NotificationPreferencesSupabaseClient = {
  from(table: 'notification_preferences'): {
    select(columns: string): {
      eq(column: 'identity_id', value: string): { maybeSingle(): Promise<{ data: NotificationPreferenceRow | null; error: Error | null }> };
    };
    upsert(payload: NotificationPreferencesUpsertPayload, options: { onConflict: 'identity_id' }): {
      select(columns: string): { single(): Promise<{ data: NotificationPreferenceRow | null; error: Error | null }> };
    };
  };
};

export type NotificationUnsubscribeSupabaseClient = NotificationPreferencesSupabaseClient & {
  from(table: 'notification_unsubscribes'): {
    insert(payload: NotificationUnsubscribeInsertPayload): {
      select(columns: string): { single(): Promise<{ data: NotificationUnsubscribeRow | null; error: Error | null }> };
    };
    select(columns: string): {
      eq(column: 'token_hash', value: string): { maybeSingle(): Promise<{ data: NotificationUnsubscribeRow | null; error: Error | null }> };
    };
    update(payload: NotificationUnsubscribeUpdatePayload): {
      eq(column: 'id', value: string): { select(columns: string): { single(): Promise<{ data: NotificationUnsubscribeRow | null; error: Error | null }> } };
    };
  };
};

export type NotificationPreferencesUpsertPayload = {
  identity_id: string;
  operational_invites_enabled: boolean;
  introduction_coordination_enabled: boolean;
  follow_up_reminders_enabled: boolean;
  outcome_prompts_enabled: boolean;
};

export type NotificationUnsubscribeInsertPayload = {
  identity_id: string;
  token_hash: string;
  scope: NotificationUnsubscribeScope;
  expires_at: string | null;
};

export type NotificationUnsubscribeUpdatePayload = { used_at: string };

const SELECT_COLUMNS =
  'id, identity_id, operational_invites_enabled, introduction_coordination_enabled, follow_up_reminders_enabled, outcome_prompts_enabled, created_at, updated_at';

export function mapNotificationPreferencesRow(row: NotificationPreferenceRow): NotificationPreferences {
  return {
    operational_invites: row.operational_invites_enabled,
    introduction_coordination: row.introduction_coordination_enabled,
    follow_up_reminders: row.follow_up_reminders_enabled,
    outcome_prompts: row.outcome_prompts_enabled,
  };
}

export function createNotificationPreferencesPayload(
  identityId: string,
  preferences: Partial<NotificationPreferences> = {},
): NotificationPreferencesUpsertPayload {
  const merged = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...preferences };

  return {
    identity_id: identityId,
    operational_invites_enabled: true,
    introduction_coordination_enabled: true,
    follow_up_reminders_enabled: merged.follow_up_reminders,
    outcome_prompts_enabled: merged.outcome_prompts,
  };
}

export async function getNotificationPreferencesByIdentityId(
  supabase: NotificationPreferencesSupabaseClient,
  identityId: string,
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select(SELECT_COLUMNS)
    .eq('identity_id', identityId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapNotificationPreferencesRow(data) : DEFAULT_NOTIFICATION_PREFERENCES;
}

export async function updateNotificationPreferences(
  supabase: NotificationPreferencesSupabaseClient,
  identityId: string,
  preferences: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(createNotificationPreferencesPayload(identityId, preferences), { onConflict: 'identity_id' })
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw error;
  if (!data) throw new Error('Notification preferences upsert did not return a row.');
  return mapNotificationPreferencesRow(data);
}

export function isOptionalMessageEligible(
  preferences: NotificationPreferences,
  category: NotificationPreferenceCategory,
): boolean {
  if (!OPTIONAL_NOTIFICATION_CATEGORIES.includes(category as never)) return true;
  return preferences[category];
}

export async function canEnqueueOptionalNotification(
  supabase: NotificationPreferencesSupabaseClient,
  identityId: string,
  category: NotificationPreferenceCategory,
): Promise<boolean> {
  return isOptionalMessageEligible(await getNotificationPreferencesByIdentityId(supabase, identityId), category);
}
