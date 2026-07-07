import { Card } from '@/components/ui';
import { OnboardingShell } from '../_components/onboarding-shell';
import { onboardingSteps } from '../steps';

export default function ProfileOnboardingPage() {
  return (
    <OnboardingShell
      badge="Private profile"
      title="Prepare a profile with useful context"
      description="This placeholder describes the future profile step where members can share enough context for warm introductions while avoiding unnecessary exposure."
      currentHref="/onboarding/profile"
      steps={[...onboardingSteps]}
      previousHref="/onboarding/role"
      previousLabel="Back to role"
      nextHref="/onboarding/privacy"
      nextLabel="Preview privacy step"
    >
      <Card className="bg-cream p-5 shadow-none">
        <h2 className="text-lg font-semibold text-ink">Context to collect later</h2>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          Future profile prompts may cover goals, industries, location preferences, and community context. This shell does not store profile details.
        </p>
      </Card>
    </OnboardingShell>
  );
}
