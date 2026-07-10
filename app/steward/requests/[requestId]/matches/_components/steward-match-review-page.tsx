import React from 'react';

import { Badge, Button, Card } from '@/components/ui';
import { decideStewardReviewAction } from '@/lib/matching/steward-review-actions';
import { recalculateMatchSuggestionsAction } from '@/lib/matching/match-actions';
import { createIntroductionFromStewardReviewAction } from '@/lib/introductions/actions';
import type { MatchSuggestion, StewardReview, StewardReviewStatus } from '@/types/matching';

type MatchReview = {
  suggestion: MatchSuggestion;
  review?: StewardReview;
};

const statusLabels: Record<StewardReviewStatus | 'unreviewed', string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  needs_info: 'Needs info',
  unreviewed: 'Not started',
};

const statusClasses: Record<StewardReviewStatus | 'unreviewed', string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
  needs_info: 'bg-sky-100 text-sky-800',
  unreviewed: 'bg-slate-100 text-slate-700',
};

function scoreTone(score: number): string {
  if (score >= 80) return 'text-emerald-700';
  if (score >= 50) return 'text-amber-700';
  return 'text-rose-700';
}

async function decideReview(formData: FormData) {
  'use server';

  const reviewId = String(formData.get('reviewId') ?? '');
  const decision = String(formData.get('decision') ?? '') as Exclude<StewardReviewStatus, 'pending'>;
  const decisionReason = String(formData.get('decisionReason') ?? '');
  await decideStewardReviewAction(reviewId, decision, { decisionReason });
}

async function createIntroduction(formData: FormData) {
  'use server';

  const reviewId = String(formData.get('reviewId') ?? '');
  await createIntroductionFromStewardReviewAction(reviewId);
}

async function recalculateMatches(formData: FormData) {
  'use server';

  const requestId = String(formData.get('requestId') ?? '');
  await recalculateMatchSuggestionsAction(requestId);
}

export function StewardMatchReviewPage({
  requestId,
  matches,
  authorized = true,
}: {
  requestId: string;
  matches: MatchReview[];
  authorized?: boolean;
}) {
  if (!authorized) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
        <Card className="border border-rose-200 bg-rose-50">
          <Badge className="bg-rose-100 text-rose-800">Access denied</Badge>
          <h1 className="mt-4 text-3xl font-bold text-ink">Steward access required</h1>
          <p className="mt-3 text-ink/70">You need an active steward or admin role to review match suggestions for this request.</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">Steward review</p>
          <h1 className="mt-2 text-4xl font-bold text-ink">Match suggestions</h1>
          <p className="mt-3 max-w-2xl text-ink/70">Review helper matches, inspect scoring reasons, and record the steward decision for request {requestId}.</p>
        </div>
        <form action={recalculateMatches}>
          <input name="requestId" type="hidden" value={requestId} />
          <Button type="submit" variant="secondary">Recalculate matches</Button>
        </form>
      </div>

      {matches.length === 0 ? (
        <Card className="mt-8 border border-dashed border-trust/25 text-center">
          <Badge>Empty queue</Badge>
          <h2 className="mt-4 text-2xl font-semibold text-ink">No matches to review yet</h2>
          <p className="mx-auto mt-3 max-w-xl text-ink/70">Run recalculation when helper availability changes or when this request is ready for a fresh match pass.</p>
        </Card>
      ) : (
        <div className="mt-8 grid gap-5">
          {matches.map(({ suggestion, review }) => {
            const status = review?.status ?? 'unreviewed';
            return (
              <Card key={suggestion.id} className="overflow-hidden">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-4">
                    <div className="flex size-20 shrink-0 flex-col items-center justify-center rounded-3xl bg-sage/60">
                      <span className={`text-2xl font-bold ${scoreTone(suggestion.score)}`}>{suggestion.score}</span>
                      <span className="text-xs font-semibold uppercase text-ink/50">score</span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-ink">#{suggestion.rank} helper {suggestion.helperIdentityId}</h2>
                        <Badge className={statusClasses[status]}>{statusLabels[status]}</Badge>
                      </div>
                      {review && status === 'approved' ? (
                        <form action={createIntroduction} className="mt-3">
                          <input name="reviewId" type="hidden" value={review.id} />
                          <Button type="submit" variant="secondary">Create introduction</Button>
                        </form>
                      ) : null}
                      <p className="mt-2 text-sm text-ink/60">Capability {suggestion.helperCapabilityId}</p>
                      {review?.decisionReason ? <p className="mt-3 rounded-2xl bg-sage/40 p-3 text-sm text-ink/75">Decision note: {review.decisionReason}</p> : null}
                    </div>
                  </div>

                  {review && (status === 'pending' || status === 'needs_info') ? (
                    <form action={decideReview} className="grid gap-3 rounded-3xl bg-sage/30 p-4 sm:min-w-80">
                      <input name="reviewId" type="hidden" value={review.id} />
                      <label className="text-sm font-semibold text-ink" htmlFor={`reason-${review.id}`}>Decision note</label>
                      <textarea className="min-h-20 rounded-2xl border border-trust/15 bg-white px-4 py-3 text-sm outline-none focus:border-trust focus:ring-4 focus:ring-trust/10" id={`reason-${review.id}`} name="decisionReason" placeholder="Add context for the requester or helper." />
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Button name="decision" type="submit" value="approved">Approve</Button>
                        <Button name="decision" type="submit" value="rejected" variant="secondary">Reject</Button>
                        <Button name="decision" type="submit" value="needs_info" variant="ghost">Needs info</Button>
                      </div>
                    </form>
                  ) : review ? (
                    <div className="rounded-3xl bg-sage/30 p-4 text-sm text-ink/70 sm:min-w-72">This steward decision is finalized and cannot be changed.</div>
                  ) : (
                    <div className="rounded-3xl bg-sage/30 p-4 text-sm text-ink/70 sm:min-w-72">Create a steward review before recording a decision for this match.</div>
                  )}
                </div>

                <div className="mt-5 border-t border-ink/10 pt-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/60">Why this match</h3>
                  <ul className="mt-3 grid gap-2 text-sm text-ink/75">
                    {suggestion.reasons.length > 0 ? suggestion.reasons.map((reason) => <li className="rounded-2xl bg-sage/30 px-4 py-3" key={reason}>{reason}</li>) : <li className="rounded-2xl bg-sage/30 px-4 py-3">No scoring reasons were recorded for this suggestion.</li>}
                  </ul>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
