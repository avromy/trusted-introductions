import { Card } from '@/components/ui';
import { OnboardingShell } from '../_components/onboarding-shell';
import { onboardingSteps } from '../steps';

export default function RoleOnboardingPage() {
  return (
    <OnboardingShell
      badge="Member role"
      title="Choose how you expect to participate"
      description="This placeholder frames the future choice between seeking help, offering warm access, or doing both without saving a selection yet."
      currentHref="/onboarding/role"
      steps={[...onboardingSteps]}
      previousHref="/onboarding/invite"
      previousLabel="Back to invite"
      nextHref="/onboarding/profile"
      nextLabel="Preview profile step"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {['Seeking support', 'Offering help', 'Both'].map((role) => (
          <Card key={role} className="bg-cream p-5 text-center text-sm font-semibold text-trust shadow-none">
            {role}
          </Card>
        ))}
      </div>
    </OnboardingShell>
  );
}
