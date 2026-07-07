import { Card } from '@/components/ui';
import { OnboardingShell } from '../_components/onboarding-shell';
import { onboardingSteps } from '../steps';

export default function PrivacyOnboardingPage() {
  return (
    <OnboardingShell
      badge="Privacy controls"
      title="Set expectations before anything is shared"
      description="This placeholder reinforces the product direction: members should understand consent, visibility, and steward review before introductions are requested."
      currentHref="/onboarding/privacy"
      steps={[...onboardingSteps]}
      previousHref="/onboarding/profile"
      previousLabel="Back to profile"
      nextHref="/onboarding/complete"
      nextLabel="Preview completion"
    >
      <div className="space-y-3">
        {['Private by default', 'Helper consent before outreach', 'Human steward review'].map((principle) => (
          <Card key={principle} className="bg-cream p-5 text-sm font-semibold text-trust shadow-none">
            {principle}
          </Card>
        ))}
      </div>
    </OnboardingShell>
  );
}
