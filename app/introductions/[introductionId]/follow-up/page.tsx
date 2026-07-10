import { Button, Card, Input } from '@/components/ui';
import { scheduleIntroductionFollowUpReminderAction } from '@/lib/introductions/follow-up-reminder-actions';

interface IntroductionFollowUpPageProps {
  params: { introductionId: string };
}

const REMINDER_STATUS_STEPS = [
  { label: 'Scheduled', description: 'We record this reminder for steward follow-up.' },
  {
    label: 'Private',
    description: 'Only reminder recipients and stewards should see the note context.',
  },
  {
    label: 'Ready to close',
    description: 'Use the outcome page once the introduction has a result.',
  },
];

export default function IntroductionFollowUpPage({ params }: IntroductionFollowUpPageProps) {
  async function scheduleReminder(formData: FormData) {
    'use server';

    await scheduleIntroductionFollowUpReminderAction(params.introductionId, formData);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16">
      <Card>
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">
              Follow-up reminder
            </p>
            <h1 className="mt-3 text-3xl font-bold text-ink">Schedule an introduction follow-up</h1>
            <p className="mt-4 text-ink/70">
              Pick a future check-in date, choose who should be reminded, and add only the context a
              steward needs to nudge the introduction forward.
            </p>

            <div className="mt-6 rounded-3xl border border-trust/10 bg-trust/5 p-5">
              <h2 className="text-sm font-semibold text-ink">Privacy boundary</h2>
              <p className="mt-2 text-sm leading-6 text-ink/70">
                Reminder notes are for operational follow-up. Do not paste private messages, resume
                details, compensation, health, immigration, or other sensitive conversation content.
              </p>
            </div>

            <form action={scheduleReminder} className="mt-8 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-ink" htmlFor="remindAt">
                  Due date and time
                </label>
                <p className="mt-1 text-sm text-ink/60">
                  Choose a future time when the steward should check whether the introduction needs
                  a nudge or outcome capture.
                </p>
                <Input id="remindAt" name="remindAt" required type="datetime-local" />
              </div>

              <div>
                <label
                  className="block text-sm font-semibold text-ink"
                  htmlFor="recipientIdentityIds"
                >
                  Reminder recipients
                </label>
                <p className="mt-1 text-sm text-ink/60">
                  Paste one or more trusted identity IDs. Duplicate IDs are ignored when the
                  reminder is saved.
                </p>
                <Input
                  id="recipientIdentityIds"
                  name="recipientIdentityIds"
                  placeholder="seeker identity id, helper identity id, or steward identity id"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-ink" htmlFor="note">
                  Private steward note <span className="font-normal text-ink/50">(optional)</span>
                </label>
                <p className="mt-1 text-sm text-ink/60">
                  Keep it short and action-oriented. Notes are capped at 500 characters.
                </p>
                <textarea
                  className="mt-2 min-h-28 w-full rounded-2xl border border-trust/15 bg-white px-4 py-3 text-sm font-normal outline-none transition placeholder:text-ink/40 focus:border-trust focus:ring-4 focus:ring-trust/10"
                  id="note"
                  maxLength={500}
                  name="note"
                  placeholder="Example: Check whether both sides found a time to meet."
                />
              </div>

              <div className="rounded-2xl border border-trust/10 bg-white p-4 text-sm text-ink/70">
                <p className="font-semibold text-ink">Confirmation</p>
                <p className="mt-1">
                  Submitting stores the reminder as <strong>scheduled</strong> and writes
                  privacy-safe audit metadata without copying the note text into audit details.
                </p>
              </div>

              <Button type="submit">Schedule reminder</Button>
            </form>
          </section>

          <aside className="rounded-3xl border border-trust/10 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-ink/50">
              Reminder status
            </h2>
            <ol className="mt-5 space-y-4">
              {REMINDER_STATUS_STEPS.map((step, index) => (
                <li key={step.label} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-trust text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{step.label}</span>
                    <span className="mt-1 block text-sm leading-6 text-ink/60">
                      {step.description}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </Card>
    </main>
  );
}
