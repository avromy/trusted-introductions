import { Button, Card } from '@/components/ui';
import { INTRODUCTION_OUTCOME_VALUES, type IntroductionOutcome } from '@/lib/introductions/outcomes';
import { captureIntroductionOutcomeAction } from '@/lib/introductions/outcome-actions';

const OUTCOME_COPY: Record<IntroductionOutcome, { label: string; description: string }> = {
  connected: { label: 'Connected', description: 'Both sides made contact and the introduction is no longer waiting on a first reply.' },
  meeting_scheduled: { label: 'Meeting scheduled', description: 'A live conversation, coffee chat, or interview has a date on the calendar.' },
  in_conversation: { label: 'In conversation', description: 'The introduction is active, but there is not yet a clear opportunity or close-out.' },
  opportunity_created: { label: 'Opportunity created', description: 'The introduction produced a concrete next step such as a referral or hiring loop.' },
  not_a_fit: { label: 'Not a fit', description: 'The parties connected and decided the opportunity or timing is not right.' },
  no_response: { label: 'No response', description: 'One or more parties did not reply after a reasonable follow-up window.' },
};

interface IntroductionOutcomePageProps { params: { introductionId: string } }

export default function IntroductionOutcomePage({ params }: IntroductionOutcomePageProps) {
  async function captureOutcome(formData: FormData) {
    'use server';
    await captureIntroductionOutcomeAction(params.introductionId, formData);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16">
      <Card>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">Introduction outcome</p>
        <h1 className="mt-3 text-3xl font-bold text-ink">How did this introduction go?</h1>
        <p className="mt-4 max-w-2xl text-ink/70">Capture one outcome status so stewards can learn which introductions are helping, which need a follow-up prompt, and where the trust network should improve.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-trust/10 bg-trust/5 p-5">
            <h2 className="text-sm font-semibold text-ink">Privacy boundary</h2>
            <p className="mt-2 text-sm leading-6 text-ink/70">Save the status and a brief stewardship note only. Do not include private message threads, compensation details, interview feedback, or other sensitive personal data.</p>
          </div>
          <div className="rounded-3xl border border-trust/10 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-ink">Confirmation state</h2>
            <p className="mt-2 text-sm leading-6 text-ink/70">Submitting records the selected status and privacy-safe audit metadata. The note helps stewards follow up, but the note text is not copied into audit metadata.</p>
          </div>
        </div>
        <form action={captureOutcome} className="mt-8 space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-ink">Outcome status</legend>
            <p className="text-sm text-ink/60">Choose the best current state. You can schedule another follow-up if the introduction is still active or waiting on a reply.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {INTRODUCTION_OUTCOME_VALUES.map((outcome) => (
                <label key={outcome} className="flex cursor-pointer gap-3 rounded-2xl border border-trust/10 bg-white px-4 py-3 text-sm text-ink shadow-sm transition hover:border-trust/30 hover:bg-trust/5">
                  <input required className="mt-1 h-4 w-4 accent-trust" name="outcome" type="radio" value={outcome} />
                  <span><span className="block font-semibold">{OUTCOME_COPY[outcome].label}</span><span className="mt-1 block leading-6 text-ink/60">{OUTCOME_COPY[outcome].description}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="rounded-2xl border border-trust/10 bg-white p-4">
            <p className="text-sm font-semibold text-ink">Optional follow-up prompt</p>
            <p className="mt-1 text-sm leading-6 text-ink/60">If the status is <strong>In conversation</strong> or <strong>No response</strong>, consider scheduling a follow-up reminder after saving this outcome.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink" htmlFor="note">Private steward note <span className="font-normal text-ink/50">(optional)</span></label>
            <p className="mt-1 text-sm text-ink/60">Add concise context for stewardship decisions. Notes are capped at 500 characters.</p>
            <textarea className="mt-2 min-h-28 w-full rounded-2xl border border-trust/15 bg-white px-4 py-3 text-sm font-normal outline-none transition placeholder:text-ink/40 focus:border-trust focus:ring-4 focus:ring-trust/10" id="note" maxLength={500} name="note" placeholder="Example: Helper replied; schedule another check-in if no meeting date is set." />
          </div>
          <Button type="submit">Save outcome status</Button>
        </form>
      </Card>
    </main>
  );
}
