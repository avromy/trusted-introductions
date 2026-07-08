'use server';

import { revalidatePath } from 'next/cache';
import {
  recalculateMatchSuggestionsAction,
  reviewMatchSuggestionAction,
} from '@/lib/matching/steward-review-actions';

export type StewardMatchReviewFormState = {
  ok: boolean;
  message: string | null;
};

export async function reviewMatchSuggestionFormAction(
  formData: FormData,
): Promise<void> {
  const requestId = String(formData.get('requestId') ?? '');
  const result = await reviewMatchSuggestionAction({
    suggestionId: String(formData.get('suggestionId') ?? ''),
    decision: String(formData.get('decision') ?? ''),
    reason: String(formData.get('reason') ?? ''),
  });

  if (requestId) {
    revalidatePath(`/steward/requests/${requestId}/matches`);
  }

  if (!result.ok) {
    console.error(result.message);
  }
}

export async function recalculateMatchSuggestionsFormAction(
  formData: FormData,
): Promise<void> {
  const requestId = String(formData.get('requestId') ?? '');
  const result = await recalculateMatchSuggestionsAction({ requestId });

  if (requestId) {
    revalidatePath(`/steward/requests/${requestId}/matches`);
  }

  if (!result.ok) {
    console.error(result.message);
  }
}
