'use server';

import { revalidatePath } from 'next/cache';

import {
  decideStewardMatchReview,
  recalculateStewardMatchReview,
  type StewardMatchReviewDecision,
} from '@/lib/matching/steward-review-actions';

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function decideMatchAction(formData: FormData) {
  const requestId = getString(formData, 'requestId');
  const matchSuggestionId = getString(formData, 'matchSuggestionId');
  const decision = getString(formData, 'decision') as StewardMatchReviewDecision;
  const reason = getString(formData, 'reason');

  await decideStewardMatchReview({ matchSuggestionId, decision, reason });
  revalidatePath(`/steward/requests/${requestId}/matches`);
}

export async function recalculateMatchesAction(formData: FormData) {
  const requestId = getString(formData, 'requestId');
  await recalculateStewardMatchReview({ requestId });
  revalidatePath(`/steward/requests/${requestId}/matches`);
}
