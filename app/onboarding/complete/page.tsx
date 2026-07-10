import * as React from 'react';
import Link from 'next/link';
import { Button, Card } from '@/components/ui';
import { completeOnboardingAction } from '@/lib/onboarding/completion-actions';
import { getCurrentOnboardingProgress } from '@/lib/onboarding/server';
import { OnboardingShell } from '../_components/onboarding-shell';
import { onboardingSteps } from '../steps';

import { formatMissingRequirement, getCompletionChecklist, getRoleActions } from './view-model';

async function submitCompleteOnboarding() {
  'use server';

  await completeOnboardingAction();
}

export default async function CompleteOnboardingPage() {
  const progress = await getCurrentOnboardingProgress();
  const checklist = getCompletionChecklist(progress);
  const roles = progress.state.trustedIdentity?.roles ?? [];
  const roleActions = getRoleActions(roles);
  const primaryAction = roleActions.find((action) => action.primary) ?? roleActions[0];

  return (
    <OnboardingShell
      badge={progress.isComplete ? 'Onboarding complete' : 'Almost there'}
      title={progress.isComplete ? 'You are ready for trusted introductions' : 'Finish onboarding to continue'}
      description={
        progress.isComplete
          ? 'Your essentials are in place. Complete onboarding, then jump into the seeker or helper flow that matches your selected role.'
          : 'A few required details are still missing. Use the checklist below to return to the first incomplete step.'
      }
      currentHref="/onboarding/complete"
      steps={[...onboardingSteps]}
      previousHref="/onboarding/privacy"
      previousLabel="Back to privacy"
    >
      <div className="space-y-6">
        <Card className="bg-cream p-5 shadow-none">
          <h2 className="text-lg font-semibold text-ink">Completion checklist</h2>
          <ul className="mt-4 space-y-3">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-4 rounded-2xl bg-white/70 px-4 py-3 text-sm">
                <span className="flex items-center gap-3 font-medium text-ink">
                  <span aria-hidden="true" className={item.complete ? 'text-trust' : 'text-amber-700'}>
                    {item.complete ? '✓' : '•'}
                  </span>
                  {item.label}
                </span>
                {item.complete ? (
                  <span className="rounded-full bg-sage px-3 py-1 text-xs font-semibold text-trust">Done</span>
                ) : (
                  <Link href={item.href} className="text-xs font-semibold text-trust underline-offset-4 hover:underline">
                    Finish step
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>

        {progress.isComplete ? (
          <Card className="p-5 shadow-none ring-trust/10">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-trust">Next best action</p>
            <h2 className="mt-3 text-2xl font-bold text-ink">{primaryAction.label}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/70">{primaryAction.description}</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <form action={submitCompleteOnboarding}>
                <Button type="submit">Complete onboarding</Button>
              </form>
              {roleActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={
                    action.primary
                      ? 'inline-flex items-center justify-center rounded-full bg-trust px-5 py-3 text-sm font-semibold text-white shadow-soft hover:bg-trust/90'
                      : 'inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-trust ring-1 ring-trust/15 hover:bg-sage/30'
                  }
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="border border-amber-200 bg-amber-50 p-5 shadow-none">
            <h2 className="text-lg font-semibold text-ink">Complete these items first</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-ink/75">
              {progress.missingRequirements.map((requirement) => (
                <li key={requirement}>{formatMissingRequirement(requirement)}</li>
              ))}
            </ul>
            <Link href={progress.nextRoute} className="mt-5 inline-flex items-center justify-center rounded-full bg-trust px-5 py-3 text-sm font-semibold text-white shadow-soft hover:bg-trust/90">
              Continue onboarding
            </Link>
          </Card>
        )}
      </div>
    </OnboardingShell>
  );
}
