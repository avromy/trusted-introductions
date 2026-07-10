import { Card } from '@/components/ui';
import { OnboardingShell } from '../_components/onboarding-shell';
import { onboardingSteps } from '../steps';

export default function RoleOnboardingLoading() {
  return (
    <OnboardingShell
      badge="Contribution mode"
      title="Loading your participation options"
      description="We are checking your invite, identity, and saved role preferences before you continue."
      currentHref="/onboarding/role"
      steps={[...onboardingSteps]}
      previousHref="/onboarding/invite"
      previousLabel="Back to invite"
      nextHref="/onboarding/profile"
      nextLabel="Preview profile step"
    >
      <div className="space-y-5" aria-busy="true" aria-live="polite">
        <Card className="bg-cream p-5 shadow-none">
          <div className="h-4 w-36 rounded-full bg-sage" />
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="h-16 rounded-2xl bg-white" />
            <div className="h-16 rounded-2xl bg-white" />
            <div className="h-16 rounded-2xl bg-white" />
          </div>
        </Card>
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="h-56 bg-cream p-5 shadow-none" />
          <Card className="h-56 bg-cream p-5 shadow-none" />
          <Card className="h-56 bg-cream p-5 shadow-none" />
        </div>
      </div>
    </OnboardingShell>
  );
}
