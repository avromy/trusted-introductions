'use server';

import {
  decideStewardReviewMatch,
  type StewardReviewActionIntent,
} from '@/lib/matching/steward-review-actions';

export async function decideMatchAction(
  requestId: string,
  intent: StewardReviewActionIntent,
  formData: FormData,
): Promise<void> {
  await decideStewardReviewMatch({
    requestId,
    intent,
    reviewId: String(formData.get('reviewId') ?? ''),
    reason: String(formData.get('reason') ?? ''),
  });
}
