import { createClient } from '@/lib/supabase/server';
import { hashUnsubscribeToken, generateOpaqueUnsubscribeToken } from './tokens';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  OPTIONAL_NOTIFICATION_CATEGORIES,
  isUnsubscribeScope,
  type NotificationPreferences,
  type NotificationUnsubscribeScope,
} from './types';
import {
  getNotificationPreferencesByIdentityId,
  updateNotificationPreferences,
  type NotificationUnsubscribeSupabaseClient,
} from './repository';

export type GeneratedUnsubscribeToken = { token: string; tokenHash: string; expiresAt: string };
export type ProcessUnsubscribeResult =
  | { ok: true; scope: NotificationUnsubscribeScope }
  | { ok: false; reason: 'invalid' | 'expired' | 'used' };

export function createUnsubscribeToken(now: Date = new Date()): GeneratedUnsubscribeToken {
  const token = generateOpaqueUnsubscribeToken();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30).toISOString();
  return { token, tokenHash: hashUnsubscribeToken(token), expiresAt };
}

export async function storeUnsubscribeToken(
  supabase: NotificationUnsubscribeSupabaseClient,
  identityId: string,
  scope: NotificationUnsubscribeScope = 'all_optional',
  now: Date = new Date(),
): Promise<GeneratedUnsubscribeToken> {
  if (!isUnsubscribeScope(scope)) throw new Error('Unsupported unsubscribe scope.');
  const generated = createUnsubscribeToken(now);
  const { error } = await supabase
    .from('notification_unsubscribes')
    .insert({ identity_id: identityId, token_hash: generated.tokenHash, scope, expires_at: generated.expiresAt })
    .select('id, identity_id, token_hash, scope, used_at, expires_at, created_at')
    .single();
  if (error) throw error;
  return generated;
}

export async function processUnsubscribeRequest(
  supabase: NotificationUnsubscribeSupabaseClient,
  token: string,
  now: Date = new Date(),
): Promise<ProcessUnsubscribeResult> {
  let tokenHash: string;
  try {
    tokenHash = hashUnsubscribeToken(token);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  const { data, error } = await supabase
    .from('notification_unsubscribes')
    .select('id, identity_id, token_hash, scope, used_at, expires_at, created_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) throw error;
  if (!data || !isUnsubscribeScope(data.scope)) return { ok: false, reason: 'invalid' };
  if (data.used_at) return { ok: false, reason: 'used' };
  if (data.expires_at && new Date(data.expires_at).getTime() < now.getTime()) return { ok: false, reason: 'expired' };

  const current = await getNotificationPreferencesByIdentityId(supabase, data.identity_id);
  const next: Partial<NotificationPreferences> =
    data.scope === 'all_optional'
      ? Object.fromEntries(OPTIONAL_NOTIFICATION_CATEGORIES.map((category) => [category, false]))
      : { [data.scope]: false };

  await updateNotificationPreferences(supabase, data.identity_id, { ...current, ...next });
  const updateResult = await supabase
    .from('notification_unsubscribes')
    .update({ used_at: now.toISOString() })
    .eq('id', data.id)
    .select('id, identity_id, token_hash, scope, used_at, expires_at, created_at')
    .single();
  if (updateResult.error) throw updateResult.error;

  return { ok: true, scope: data.scope };
}

export function getDefaultNotificationPreferences(): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES };
}

export function getServerNotificationPreferencesClient(): NotificationUnsubscribeSupabaseClient {
  return createClient() as unknown as NotificationUnsubscribeSupabaseClient;
}
