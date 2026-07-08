import { Button, Card, Input } from '@/components/ui';
import { scheduleIntroductionFollowUpReminderAction } from '@/lib/introductions/follow-up-reminder-actions';

interface IntroductionFollowUpPageProps {
  params: { introductionId: string };
}

export default function IntroductionFollowUpPage({ params }: IntroductionFollowUpPageProps) {
  async function scheduleReminder(formData: FormData) {
    'use server';

    await scheduleIntroductionFollowUpReminderAction(params.introductionId, formData);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <Card>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">
          Follow-up reminder
        </p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Schedule an introduction follow-up</h1>
        <p className="mt-4 text-ink/70">
          Set a lightweight reminder so stewards can check whether the warm introduction connected,
          needs another nudge, or is ready for outcome capture.
        </p>

        <form action={scheduleReminder} className="mt-8 space-y-6">
          <label className="block text-sm font-semibold text-ink" htmlFor="remindAt">
            Reminder date and time
            <Input id="remindAt" name="remindAt" required type="datetime-local" />
          </label>

          <label className="block text-sm font-semibold text-ink" htmlFor="recipientIdentityIds">
            Recipient identity IDs
            <Input
              id="recipientIdentityIds"
              name="recipientIdentityIds"
              placeholder="Paste the seeker, helper, or steward identity id"
              required
            />
          </label>

          <label className="block text-sm font-semibold text-ink" htmlFor="note">
            Optional private note
            <textarea
              className="mt-2 min-h-28 w-full rounded-2xl border border-trust/15 bg-white px-4 py-3 text-sm font-normal outline-none transition placeholder:text-ink/40 focus:border-trust focus:ring-4 focus:ring-trust/10"
              id="note"
              maxLength={500}
              name="note"
              placeholder="Add context for the follow-up without sharing sensitive conversation details."
            />
          </label>

          <Button type="submit">Schedule reminder</Button>
        </form>
      </Card>
    </main>
  );
}
