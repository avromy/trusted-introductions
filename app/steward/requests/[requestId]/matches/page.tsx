import React from 'react';

import { requireStewardOrAdmin } from '@/lib/auth/steward';
import { listMatchSuggestionsForRequest, type MatchSuggestionRepositoryClient } from '@/lib/matching/match-repository';
import { listStewardReviewsForRequest, type StewardReviewRepositoryClient } from '@/lib/matching/steward-review-repository';
import { createClient } from '@/lib/supabase/server';

import { StewardMatchReviewPage } from './_components/steward-match-review-page';

export default async function Page({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const supabase = createClient() as unknown as NonNullable<Parameters<typeof requireStewardOrAdmin>[0]> & MatchSuggestionRepositoryClient & StewardReviewRepositoryClient;

  try {
    await requireStewardOrAdmin(supabase);
  } catch {
    return <StewardMatchReviewPage authorized={false} matches={[]} requestId={requestId} />;
  }

  const [suggestions, reviews] = await Promise.all([
    listMatchSuggestionsForRequest(requestId, supabase),
    listStewardReviewsForRequest(requestId, supabase),
  ]);
  const reviewBySuggestionId = new Map(reviews.map((review) => [review.matchSuggestionId, review]));

  return <StewardMatchReviewPage matches={suggestions.map((suggestion) => ({ suggestion, review: reviewBySuggestionId.get(suggestion.id) }))} requestId={requestId} />;
}
