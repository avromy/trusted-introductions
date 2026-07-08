import { Card } from '@/components/ui';
import { listStewardReviewMatches } from '@/lib/matching/steward-review-actions';

import { decideMatchAction } from './actions';

export default async function StewardRequestMatchesPage({
  params,
}: {
  params: { requestId: string };
}) {
  const matches = await listStewardReviewMatches(params.requestId);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">
          Steward review
        </p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Suggested matches</h1>
        <p className="mt-3 text-ink/70">
          Review helper suggestions for request {params.requestId} before an introduction is made.
        </p>
      </div>

      <div className="space-y-5">
        {matches.length === 0 ? (
          <Card>
            <h2 className="text-xl font-semibold text-ink">No suggested matches yet</h2>
            <p className="mt-2 text-ink/70">
              New helper suggestions will appear here for steward review.
            </p>
          </Card>
        ) : (
          matches.map((match) => {
            const action = decideMatchAction.bind(null, params.requestId);
            const isFinal = match.status === 'approved' || match.status === 'rejected';

            return (
              <Card key={match.id} className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-trust">
                      {match.status.replace('_', ' ')}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-ink">
                      {match.candidateName ?? 'Suggested helper'}
                    </h2>
                    {match.candidateEmail ? (
                      <p className="text-ink/60">{match.candidateEmail}</p>
                    ) : null}
                  </div>
                  <p className="rounded-full bg-sage px-4 py-2 text-sm font-semibold text-trust">
                    {match.matchScore ?? 'Unscored'} match score
                  </p>
                </div>

                <pre className="overflow-auto rounded-2xl bg-cream p-4 text-sm text-ink/75">
                  {JSON.stringify(match.matchExplanation ?? {}, null, 2)}
                </pre>

                {isFinal ? (
                  <p className="text-sm text-ink/70">
                    This suggestion has a final steward decision.
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-3">
                    {(['approve', 'reject', 'needs_info'] as const).map((intent) => (
                      <form key={intent} action={action.bind(null, intent)} className="space-y-2">
                        <input type="hidden" name="reviewId" value={match.id} />
                        <label
                          className="block text-sm font-medium text-ink"
                          htmlFor={`${match.id}-${intent}`}
                        >
                          Reason
                        </label>
                        <textarea
                          id={`${match.id}-${intent}`}
                          name="reason"
                          className="min-h-20 w-full rounded-2xl border border-black/10 bg-white p-3 text-sm"
                          placeholder="Optional private steward note"
                        />
                        <button
                          className="w-full rounded-full bg-trust px-4 py-2 text-sm font-semibold text-white"
                          type="submit"
                        >
                          {intent === 'needs_info' ? 'Needs info' : intent}
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </main>
  );
}
