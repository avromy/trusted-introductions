import { Card } from '@/components/ui';
import { OnboardingShell } from '../_components/onboarding-shell';
import { onboardingSteps } from '../steps';

export default function InviteOnboardingPage() {
  return (
    <OnboardingShell
      badge="Invitation"
      title="Start with a trusted invitation"
      description="This placeholder will introduce how a member arrives through a trusted bridge before any account setup or community access happens."
      currentHref="/onboarding/invite"
      steps={[...onboardingSteps]}
      nextHref="/onboarding/role"
      nextLabel="Preview role step"
    >
      <Card className="bg-cream p-5 shadow-none">
        <h2 className="text-lg font-semibold text-ink">Future intent</h2>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          Invite redemption will stay consent-based and human-readable. No invite token is validated on this placeholder page.
        </p>
      </Card>
    </OnboardingShell>
  );
}
