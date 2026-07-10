import { processUnsubscribeRequest, getServerNotificationPreferencesClient } from '@/lib/notifications/preferences';

export default async function UnsubscribeConfirmationPage({ params }: { params: { token: string } }) {
  const result = await processUnsubscribeRequest(getServerNotificationPreferencesClient(), params.token);
  const success = result.ok;

  return (
    <main className="mx-auto max-w-xl space-y-4 px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-trust">Notification preferences</p>
      <h1 className="text-3xl font-bold text-ink">{success ? 'You have been unsubscribed' : 'This unsubscribe link cannot be used'}</h1>
      <p className="text-sm leading-6 text-ink/70">
        {success
          ? 'Optional reminders have been turned off. Essential transactional, invite, introduction coordination, and security-related messages may still be sent when needed.'
          : 'The link may be invalid, expired, or already used. No identity or account details are shown on this page.'}
      </p>
    </main>
  );
}
