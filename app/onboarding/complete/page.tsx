import Link from 'next/link';
import { Card } from '@/components/ui';
import { OnboardingShell } from '../_components/onboarding-shell';
import { onboardingSteps } from '../steps';

export default function CompleteOnboardingPage() {
  return (
    <OnboardingShell
      badge="Completion preview"
      title="Onboarding shell complete"
      description="This placeholder marks the end of the preview flow only. It does not confirm membership, redeem an invite, create matches, or write any data."
      currentHref="/onboarding/complete"
      steps={[...onboardingSteps]}
      previousHref="/onboarding/privacy"
      previousLabel="Back to privacy"
    >
      <Card className="bg-cream p-5 shadow-none">
        <h2 className="text-lg font-semibold text-ink">What happens in a later milestone</h2>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          Future work can connect approved account state, steward review, and next-step guidance once the underlying business logic exists.
        </p>
        <Link href="/dashboard" className="mt-5 inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-trust ring-1 ring-trust/15 hover:bg-sage/30">
          View existing dashboard placeholder
        </Link>
      </Card>
    </OnboardingShell>
  );
}
