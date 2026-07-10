import { requireStewardOrAdmin, toSafeAuthFailureResult } from '@/lib/auth/steward';
import { getIntroductionById } from '@/lib/introductions/repository';

import { IntroductionDetail, StateCard } from './introduction-detail';

interface StewardIntroductionPageProps {
  params: Promise<{ introductionId: string }>;
}

export default async function StewardIntroductionPage({ params }: StewardIntroductionPageProps) {
  try {
    await requireStewardOrAdmin();
  } catch (error) {
    const authFailure = toSafeAuthFailureResult(error);
    return (
      <StateCard
        state={
          authFailure.error === 'auth_required' || authFailure.error === 'forbidden'
            ? 'unauthorized'
            : 'error'
        }
      />
    );
  }

  try {
    const { introductionId } = await params;
    const introduction = await getIntroductionById(introductionId);

    if (!introduction) {
      return <StateCard state="empty" />;
    }

    return <IntroductionDetail introduction={introduction} />;
  } catch {
    return <StateCard state="error" />;
  }
}
