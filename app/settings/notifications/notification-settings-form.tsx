'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button, Card } from '@/components/ui';
import type { NotificationPreferences } from '@/lib/notifications/preferences';
import { saveNotificationPreferencesAction, type NotificationSettingsFormState } from './actions';

const initialState: NotificationSettingsFormState = { ok: false, message: null };

function SaveButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save notification settings'}</Button>;
}

export function NotificationSettingsForm({ preferences }: { preferences: NotificationPreferences }) {
  const [state, formAction] = useFormState(saveNotificationPreferencesAction, initialState);
  return (
    <form action={formAction} className="space-y-5">
      <Card className="space-y-4 bg-cream p-5 shadow-none">
        <div>
          <h2 className="text-lg font-semibold text-ink">Required account messages</h2>
          <p className="text-sm leading-6 text-ink/70">Operational invite, introduction coordination, and security-related messages remain enabled so the service can work safely.</p>
        </div>
        <div className="grid gap-3 text-sm text-ink/70">
          <p><strong className="text-ink">Operational invite messages:</strong> always enabled.</p>
          <p><strong className="text-ink">Introduction coordination:</strong> always enabled for active introductions.</p>
        </div>
      </Card>
      <Card className="space-y-4 p-5">
        <h2 className="text-lg font-semibold text-ink">Optional reminders</h2>
        <label className="flex items-start gap-3 text-sm font-medium text-ink">
          <input name="follow_up_reminders" type="checkbox" defaultChecked={preferences.follow_up_reminders} className="mt-1 h-4 w-4" />
          <span><span className="block font-semibold">Follow-up reminders</span><span className="block text-xs text-ink/60">Receive nudges to close the loop after introductions.</span></span>
        </label>
        <label className="flex items-start gap-3 text-sm font-medium text-ink">
          <input name="outcome_prompts" type="checkbox" defaultChecked={preferences.outcome_prompts} className="mt-1 h-4 w-4" />
          <span><span className="block font-semibold">Outcome prompts</span><span className="block text-xs text-ink/60">Receive requests to share whether an introduction helped.</span></span>
        </label>
      </Card>
      {state.message ? <p className={state.ok ? 'text-sm font-semibold text-trust' : 'text-sm font-semibold text-rust'} aria-live="polite">{state.message}</p> : null}
      <SaveButton />
    </form>
  );
}
