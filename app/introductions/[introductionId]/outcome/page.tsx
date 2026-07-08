import { Button, Card } from '@/components/ui';
import { INTRODUCTION_OUTCOME_VALUES, type IntroductionOutcome } from '@/lib/introductions/outcomes';
import { captureIntroductionOutcomeAction } from '@/lib/introductions/outcome-actions';

const OUTCOME_LABELS: Record<IntroductionOutcome, string> = {
  connected: 'We connected',
  meeting_scheduled: 'Meeting scheduled',
  in_conversation: 'Conversation is active',
  opportunity_created: 'Opportunity created',
  not_a_fit: 'Not a fit',
  no_response: 'No response',
};

interface IntroductionOutcomePageProps {
  params: { introductionId: string };
}

export default function IntroductionOutcomePage({ params }: IntroductionOutcomePageProps) {
  async function captureOutcome(formData: FormData) {
    'use server';

    await captureIntroductionOutcomeAction(params.introductionId, formData);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <Card>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">
          Introduction outcome
        </p>
        <h1 className="mt-3 text-3xl font-bold text-ink">How did this introduction go?</h1>
        <p className="mt-4 text-ink/70">
          Capture a lightweight status so stewards can learn which introductions are helping and where follow-up is needed.
        </p>

        <form action={captureOutcome} className="mt-8 space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-ink">Outcome</legend>
            {INTRODUCTION_OUTCOME_VALUES.map((outcome) => (
              <label
                key={outcome}
                className="flex items-center gap-3 rounded-2xl border border-trust/10 bg-white px-4 py-3 text-sm text-ink shadow-sm"
              >
                <input className="h-4 w-4 accent-trust" name="outcome" type="radio" value={outcome} />
                {OUTCOME_LABELS[outcome]}
              </label>
            ))}
          </fieldset>

          <label className="block text-sm font-semibold text-ink" htmlFor="note">
            Optional private note
            <textarea
              className="mt-2 min-h-28 w-full rounded-2xl border border-trust/15 bg-white px-4 py-3 text-sm font-normal outline-none transition placeholder:text-ink/40 focus:border-trust focus:ring-4 focus:ring-trust/10"
              id="note"
              maxLength={500}
              name="note"
              placeholder="Add context for stewards without sharing sensitive conversation details."
            />
          </label>

          <Button type="submit">Save outcome</Button>
        </form>
      </Card>
    </main>
  );
}
