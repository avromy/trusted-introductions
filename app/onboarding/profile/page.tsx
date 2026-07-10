import React from 'react';

import { Button, Card, Input } from '@/components/ui';
import { OnboardingShell } from '../_components/onboarding-shell';
import { onboardingSteps } from '../steps';
import { submitOnboardingProfile } from './actions';

type ProfileOnboardingPageProps = {
  searchParams?: {
    error?: string;
    saved?: string;
  };
};

export default function ProfileOnboardingPage({ searchParams }: ProfileOnboardingPageProps) {
  const errorMessage = searchParams?.error;
  const successMessage =
    searchParams?.saved === '1'
      ? 'Profile saved. Review the completion guidance below, then continue to privacy settings.'
      : null;

  return (
    <OnboardingShell
      badge="Private profile"
      title="Prepare a profile with useful context"
      description="Share a small amount of context for warm introductions while avoiding unnecessary exposure."
      currentHref="/onboarding/profile"
      steps={[...onboardingSteps]}
      previousHref="/onboarding/role"
      previousLabel="Back to role"
      nextHref="/onboarding/privacy"
      nextLabel="Continue to privacy"
    >
      <Card className="bg-cream p-5 shadow-none">
        <form action={submitOnboardingProfile} className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">Profile basics</h2>
            <p className="mt-2 text-sm leading-6 text-ink/70">
              Add the context stewards need to make relevant introductions. Required details are
              marked, and optional fields can stay blank until you have something useful to share.
            </p>
          </div>

          {errorMessage ? (
            <div
              aria-live="polite"
              role="alert"
              className="rounded-2xl border border-rust/20 bg-rust/10 px-4 py-3 text-sm text-rust"
            >
              <p className="font-semibold">We could not save your profile.</p>
              <p className="mt-1">{errorMessage}</p>
            </div>
          ) : null}
          {successMessage ? (
            <div
              aria-live="polite"
              className="rounded-2xl border border-trust/20 bg-trust/10 px-4 py-3 text-sm text-trust"
            >
              <p className="font-semibold">Profile details saved.</p>
              <p className="mt-1">{successMessage}</p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-ink" htmlFor="displayName">
              Display name <span className="text-rust">*</span>
              <Input
                aria-describedby="displayName-help"
                autoComplete="name"
                id="displayName"
                name="displayName"
                placeholder="Ada Lovelace"
                required
                minLength={2}
                maxLength={120}
              />
              <span
                id="displayName-help"
                className="block text-xs font-normal leading-5 text-ink/60"
              >
                Use the name members should recognize when a steward introduces you.
              </span>
            </label>
            <label className="space-y-2 text-sm font-semibold text-ink" htmlFor="location">
              Location <span className="font-normal text-ink/50">Optional</span>
              <Input
                aria-describedby="location-help"
                autoComplete="address-level2"
                id="location"
                name="location"
                maxLength={120}
                placeholder="San Francisco, remote, or time zone"
              />
              <span id="location-help" className="block text-xs font-normal leading-5 text-ink/60">
                Share a city, region, remote preference, or time zone if it helps coordination.
              </span>
            </label>
          </div>

          <label className="block space-y-2 text-sm font-semibold text-ink" htmlFor="headline">
            Headline <span className="font-normal text-ink/50">Optional</span>
            <Input
              aria-describedby="headline-help"
              id="headline"
              name="headline"
              maxLength={160}
              placeholder="Product leader exploring trusted referral networks"
            />
            <span id="headline-help" className="block text-xs font-normal leading-5 text-ink/60">
              One sentence that explains what you do, what you are seeking, or how you can help.
            </span>
          </label>

          <label className="block space-y-2 text-sm font-semibold text-ink" htmlFor="summary">
            Summary <span className="font-normal text-ink/50">Optional</span>
            <textarea
              aria-describedby="summary-help"
              id="summary"
              name="summary"
              maxLength={1000}
              rows={5}
              className="w-full rounded-2xl border border-trust/15 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-ink/40 focus:border-trust focus:ring-4 focus:ring-trust/10"
              placeholder="Briefly describe your goals, industries, strengths, or the introductions that would be most useful."
            />
            <span id="summary-help" className="block text-xs font-normal leading-5 text-ink/60">
              Keep it focused. This context supports matching; privacy settings in the next step
              control who can see profile details.
            </span>
          </label>

          <div className="rounded-2xl border border-trust/15 bg-white px-4 py-3 text-sm leading-6 text-ink/70">
            <p className="font-semibold text-ink">Completion guidance</p>
            <p className="mt-1">
              Saving this step marks your profile setup complete. Continue to privacy settings next
              to choose who can view profile, resume, and contact details.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Save profile</Button>
            <p className="text-sm text-ink/60">
              We save only the supported profile fields shown here.
            </p>
          </div>
        </form>
      </Card>
    </OnboardingShell>
  );
}
