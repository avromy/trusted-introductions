import { Card } from '@/components/ui';

export default function NotificationSettingsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <Card>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">Notifications</p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Notification preferences</h1>
        <p className="mt-4 text-ink/70">Required invite and introduction coordination messages remain enabled. Optional reminders require your explicit choice.</p>
        <form className="mt-8 space-y-4">
          <label className="flex items-start gap-3"><input type="checkbox" name="follow_up_reminder" /><span><strong>Follow-up reminders</strong><span className="block text-sm text-ink/60">Receive operational reminders about active introductions.</span></span></label>
          <label className="flex items-start gap-3"><input type="checkbox" name="outcome_prompt" /><span><strong>Outcome prompts</strong><span className="block text-sm text-ink/60">Receive requests for a lightweight introduction status.</span></span></label>
          <button className="rounded-2xl bg-trust px-5 py-3 font-semibold text-white" type="submit">Save preferences</button>
        </form>
      </Card>
    </main>
  );
}
