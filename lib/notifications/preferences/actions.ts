'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseAuthClient } from '@/lib/auth/session';
import { requireCurrentUser } from '@/lib/auth/session';
import { updateNotificationPreferences } from './repository';
import type { NotificationPreferencesSupabaseClient } from './repository';
import type { NotificationPreferences } from './types';

export type NotificationSettingsFormState = { ok: boolean; message: string | null };

type IdentityLookupClient = SupabaseAuthClient & NotificationPreferencesSupabaseClient & {
  from(table: 'trusted_identities'): {
    select(columns: string): { eq(column: 'user_id', value: string): { maybeSingle(): Promise<{ data: { id: string; status: string } | null; error: Error | null }> } };
  };
};

function readPreferences(formData: FormData): Partial<NotificationPreferences> {
  return {
    operational_invites: true,
    introduction_coordination: true,
    follow_up_reminders: formData.get('follow_up_reminders') === 'on',
    outcome_prompts: formData.get('outcome_prompts') === 'on',
  };
}

export async function saveNotificationPreferencesAction(
  _state: NotificationSettingsFormState,
  formData: FormData,
): Promise<NotificationSettingsFormState> {
  const supabase = createClient() as unknown as IdentityLookupClient;
  const user = await requireCurrentUser(supabase);
  const identityResult = await supabase
    .from('trusted_identities')
    .select('id, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (identityResult.error) throw identityResult.error;
  if (!identityResult.data || identityResult.data.status !== 'active') {
    return { ok: false, message: 'An active trusted identity is required to update notification settings.' };
  }

  await updateNotificationPreferences(supabase, identityResult.data.id, readPreferences(formData));
  revalidatePath('/settings/notifications');
  return { ok: true, message: 'Notification preferences saved.' };
}
