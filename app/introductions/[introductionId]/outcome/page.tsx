import { redirect } from 'next/navigation';

import { Button, Card, Input } from '@/components/ui';
import { INTRODUCTION_OUTCOME_STATUSES } from '@/lib/introductions/outcomes';
import { recordIntroductionOutcomeAction } from '@/lib/introductions/outcome-actions';

type IntroductionOutcomePageProps = {
  params: { introductionId: string };
  searchParams?: { saved?: string; error?: string };
};

const outcomeLabels: Record<(typeof INTRODUCTION_OUTCOME_STATUSES)[number], string> = {
  completed: 'Completed',
  declined: 'Declined',
  unresponsive: 'Unresponsive',
  follow_up_needed: 'Follow-up needed',
};

export default function IntroductionOutcomePage({
  params,
  searchParams,
}: IntroductionOutcomePageProps) {
  async function action(formData: FormData): Promise<void> {
    'use server';

    const result = await recordIntroductionOutcomeAction(params.introductionId, formData);

    if (result.ok) {
      redirect(`/introductions/${params.introductionId}/outcome?saved=1`);
    }

    redirect(
      `/introductions/${params.introductionId}/outcome?error=${encodeURIComponent(result.message)}`,
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <Card className="w-full">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">
          Introduction outcome
        </p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Record what happened</h1>
        <p className="mt-4 text-sm leading-6 text-ink/70">
          Capture the outcome for this introduction. Notes are optional, trimmed for safety,
          and only a safe note summary is exposed after saving.
        </p>

        {searchParams?.saved === '1' ? (
          <p className="mt-5 rounded-2xl bg-trust/10 px-4 py-3 text-sm font-medium text-trust">
            Outcome recorded.
          </p>
        ) : null}
        {searchParams?.error ? (
          <p className="mt-5 rounded-2xl bg-rust/10 px-4 py-3 text-sm font-medium text-rust">
            {searchParams.error}
          </p>
        ) : null}

        <form action={action} className="mt-6 space-y-5">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-ink">Outcome status</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {INTRODUCTION_OUTCOME_STATUSES.map((status) => (
                <label
                  key={status}
                  className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3 text-sm font-medium text-ink ring-1 ring-trust/10"
                >
                  <input required type="radio" name="outcomeStatus" value={status} />
                  {outcomeLabels[status]}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block space-y-2 text-sm font-semibold text-ink" htmlFor="notes">
            Notes (optional)
            <textarea
              id="notes"
              name="notes"
              maxLength={1000}
              rows={4}
              className="w-full rounded-2xl border border-trust/15 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-ink/40 focus:border-trust focus:ring-4 focus:ring-trust/10"
              placeholder="Add concise, non-sensitive context only when needed."
            />
          </label>

          <label className="block space-y-2 text-sm font-semibold text-ink" htmlFor="followUpAt">
            Follow-up reminder date (optional)
            <Input id="followUpAt" name="followUpAt" type="date" />
          </label>

          <Button type="submit">Save outcome</Button>
        </form>
      </Card>
    </main>
  );
}
