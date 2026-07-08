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
    searchParams?.saved === '1' ? 'Profile saved. You can continue to privacy settings.' : null;

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
              Keep this concise. You can refine these details later as the network grows.
            </p>
          </div>

          {errorMessage ? (
            <p className="rounded-2xl bg-rust/10 px-4 py-3 text-sm font-medium text-rust">
              {errorMessage}
            </p>
          ) : null}
          {successMessage ? (
            <p className="rounded-2xl bg-trust/10 px-4 py-3 text-sm font-medium text-trust">
              {successMessage}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-ink" htmlFor="displayName">
              Display name
              <Input id="displayName" name="displayName" required minLength={2} maxLength={120} />
            </label>
            <label className="space-y-2 text-sm font-semibold text-ink" htmlFor="location">
              Location
              <Input id="location" name="location" maxLength={120} placeholder="Optional" />
            </label>
          </div>

          <label className="block space-y-2 text-sm font-semibold text-ink" htmlFor="headline">
            Headline
            <Input
              id="headline"
              name="headline"
              maxLength={160}
              placeholder="Optional short intro"
            />
          </label>

          <label className="block space-y-2 text-sm font-semibold text-ink" htmlFor="summary">
            Summary
            <textarea
              id="summary"
              name="summary"
              maxLength={1000}
              rows={5}
              className="w-full rounded-2xl border border-trust/15 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-ink/40 focus:border-trust focus:ring-4 focus:ring-trust/10"
              placeholder="Optional context about goals, industries, or how you can help."
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Save profile</Button>
            <p className="text-sm text-ink/60">Only basic onboarding profile details are saved.</p>
          </div>
        </form>
      </Card>
    </OnboardingShell>
  );
}
