import { decideMatchAction, recalculateMatchesAction } from './actions';
import { getStewardMatchReviewPageData } from '@/lib/matching/steward-review-actions';

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'Not specified';
}

export default async function StewardRequestMatchesPage({
  params,
}: {
  params: { requestId: string };
}) {
  const { request, matches } = await getStewardMatchReviewPageData(params.requestId);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Steward review
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">{request.headline}</h1>
            <p className="mt-2 text-slate-700">Target role: {request.targetRole}</p>
          </div>
          <form action={recalculateMatchesAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Recalculate
            </button>
          </form>
        </div>
        <dl className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-slate-500">Status</dt>
            <dd className="mt-1 text-slate-950">{request.status}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Remote preference</dt>
            <dd className="mt-1 text-slate-950">{request.remotePreference ?? 'Not specified'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Target companies</dt>
            <dd className="mt-1 text-slate-950">{formatList(request.targetCompanies)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Target locations</dt>
            <dd className="mt-1 text-slate-950">{formatList(request.targetLocations)}</dd>
          </div>
        </dl>
        {request.notes ? (
          <div className="mt-6 rounded-xl bg-slate-50 p-4">
            <h2 className="text-sm font-semibold text-slate-700">Private steward notes</h2>
            <p className="mt-2 whitespace-pre-wrap text-slate-700">{request.notes}</p>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Persisted match suggestions</h2>
          <p className="mt-1 text-slate-600">
            Review the current saved suggestions without changing the matching algorithm.
          </p>
        </div>

        {matches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-600">
            No persisted match suggestions are available for this request yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {matches.map((match) => (
              <article
                key={match.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">
                      Helper identity {match.helperIdentityId}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">Review status: {match.status}</p>
                  </div>
                  <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                    Score {match.matchScore}
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-slate-700">Explanation</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
                    {match.matchExplanation.reasons.length > 0 ? (
                      match.matchExplanation.reasons.map((reason) => <li key={reason}>{reason}</li>)
                    ) : (
                      <li>No explanation was stored with this suggestion.</li>
                    )}
                  </ul>
                </div>
                <form
                  action={decideMatchAction}
                  className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]"
                >
                  <input type="hidden" name="requestId" value={request.id} />
                  <input type="hidden" name="matchSuggestionId" value={match.id} />
                  <input
                    name="reason"
                    placeholder="Optional private decision note"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    name="decision"
                    value="approved"
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Approve
                  </button>
                  <button
                    name="decision"
                    value="rejected"
                    className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Reject
                  </button>
                  <button
                    name="decision"
                    value="needs_info"
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950"
                  >
                    Needs info
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
