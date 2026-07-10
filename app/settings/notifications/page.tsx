import { createClient } from '@/lib/supabase/server';
import { getDefaultNotificationPreferences, getNotificationPreferencesByIdentityId } from '@/lib/notifications/preferences';
import { NotificationSettingsForm } from './notification-settings-form';

export default async function NotificationSettingsPage() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  let preferences = getDefaultNotificationPreferences();
  let loadError: string | null = null;

  if (userData.user) {
    const identityResult = await supabase.from('trusted_identities').select('id, status').eq('user_id', userData.user.id).maybeSingle();
    if (identityResult.error) loadError = 'We could not load your notification settings yet.';
    else if (identityResult.data) {
      const identity = identityResult.data as { id: string };
      preferences = await getNotificationPreferencesByIdentityId(supabase as never, identity.id);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-trust">Notification settings</p>
        <h1 className="text-3xl font-bold text-ink">Choose optional notification preferences</h1>
        <p className="text-sm leading-6 text-ink/70">Defaults are restrictive: optional reminders start off unless you opt in. Required transactional and security messages remain separate.</p>
      </div>
      {loadError ? <p className="text-sm font-semibold text-rust">{loadError}</p> : null}
      <NotificationSettingsForm preferences={preferences} />
    </main>
  );
}
