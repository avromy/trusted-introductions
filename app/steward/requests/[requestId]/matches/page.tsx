import { requireStewardOrAdmin, toSafeAuthFailureResult } from '@/lib/auth/steward';
import { createClient } from '@/lib/supabase/server';
import type { PersistedMatchSuggestion } from '@/lib/matching/steward-review-actions';
import type { JobSeekerRequest } from '@/types/matching';
import type { Json } from '@/types/supabase';
import {
  recalculateMatchSuggestionsFormAction,
  reviewMatchSuggestionFormAction,
} from './actions';

type PageProps = { params: { requestId: string } };

type RequestRow = {
  id: string;
  identity_id: string;
  status: JobSeekerRequest['status'];
  headline: string;
  target_role: string;
  target_companies: string[] | null;
  target_locations: string[] | null;
  remote_preference: string | null;
  created_at: string;
  updated_at: string;
};

type PageClient = ReturnType<typeof createClient> & {
  from(table: 'job_seeker_requests'): {
    select(columns?: string): {
      eq(column: 'id', value: string): {
        maybeSingle(): Promise<{ data: RequestRow | null; error: Error | null }>;
      };
    };
  };
  from(table: 'match_suggestions'): {
    select(columns?: string): {
      eq(column: 'request_id', value: string): {
        order(column: 'score' | 'created_at', options?: { ascending?: boolean }): Promise<{
          data: PersistedMatchSuggestion[] | null;
          error: Error | null;
        }>;
      };
    };
  };
};

const REQUEST_COLUMNS =
  'id, identity_id, status, headline, target_role, target_companies, target_locations, remote_preference, created_at, updated_at';
const SUGGESTION_COLUMNS =
  'id, request_id, helper_identity_id, score, explanation, review_status, reviewed_by_identity_id, reviewed_at, review_reason, created_at, updated_at';

function safeExplanation(explanation: Json): string[] {
  if (explanation && typeof explanation === 'object' && !Array.isArray(explanation)) {
    const reasons = explanation.reasons;
    if (Array.isArray(reasons)) {
      return reasons.filter((reason): reason is string => typeof reason === 'string').slice(0, 5);
    }
  }
  return ['No explanation available.'];
}

function AuthDenied({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold text-ink">Match review unavailable</h1>
      <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{message}</p>
    </main>
  );
}

export default async function StewardRequestMatchesPage({ params }: PageProps) {
  const supabase = createClient() as unknown as PageClient;

  try {
    await requireStewardOrAdmin(supabase as Parameters<typeof requireStewardOrAdmin>[0]);
  } catch (error) {
    const safe = toSafeAuthFailureResult(error);
    return <AuthDenied message={safe.message} />;
  }

  const [{ data: request, error: requestError }, { data: suggestions, error: suggestionsError }] =
    await Promise.all([
      supabase.from('job_seeker_requests').select(REQUEST_COLUMNS).eq('id', params.requestId).maybeSingle(),
      supabase
        .from('match_suggestions')
        .select(SUGGESTION_COLUMNS)
        .eq('request_id', params.requestId)
        .order('score', { ascending: false }),
    ]);

  if (requestError || suggestionsError) {
    throw requestError ?? suggestionsError;
  }

  if (!request) {
    return <AuthDenied message="Request was not found or is not available for steward review." />;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="rounded-3xl border border-ink/10 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">Steward review</p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Match suggestions</h1>
        <section className="mt-6 grid gap-3 text-sm text-ink/80 md:grid-cols-2">
          <p><span className="font-semibold text-ink">Headline:</span> {request.headline}</p>
          <p><span className="font-semibold text-ink">Target role:</span> {request.target_role}</p>
          <p><span className="font-semibold text-ink">Companies:</span> {(request.target_companies ?? []).join(', ') || 'Any'}</p>
          <p><span className="font-semibold text-ink">Locations:</span> {(request.target_locations ?? []).join(', ') || 'Any'}</p>
          <p><span className="font-semibold text-ink">Status:</span> {request.status}</p>
          <p><span className="font-semibold text-ink">Remote:</span> {request.remote_preference ?? 'Not specified'}</p>
        </section>
        <form action={recalculateMatchSuggestionsFormAction} className="mt-6">
          <input type="hidden" name="requestId" value={request.id} />
          <button className="rounded-full bg-trust px-4 py-2 text-sm font-semibold text-white" type="submit">
            Recalculate matches
          </button>
        </form>
      </div>

      <section className="mt-8 space-y-4">
        {(suggestions ?? []).length === 0 ? (
          <p className="rounded-2xl border border-ink/10 bg-white p-5 text-sm text-ink/70">No persisted match suggestions yet.</p>
        ) : (
          (suggestions ?? []).map((suggestion) => (
            <article key={suggestion.id} className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Helper candidate</h2>
                  <p className="text-sm text-ink/60">ID: {suggestion.helper_identity_id}</p>
                </div>
                <p className="rounded-full bg-sage/40 px-3 py-1 text-sm font-semibold text-ink">
                  {suggestion.score ?? 0}% · {suggestion.review_status.replace('_', ' ')}
                </p>
              </div>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink/75">
                {safeExplanation(suggestion.explanation).map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
              <form action={reviewMatchSuggestionFormAction} className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="suggestionId" value={suggestion.id} />
                <input className="rounded-xl border border-ink/15 px-3 py-2 text-sm" name="reason" placeholder="Optional private reason" />
                <button className="rounded-full bg-trust px-4 py-2 text-sm font-semibold text-white" name="decision" value="approved" type="submit">Approve</button>
                <button className="rounded-full bg-rose-700 px-4 py-2 text-sm font-semibold text-white" name="decision" value="rejected" type="submit">Reject</button>
                <button className="rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white" name="decision" value="needs_info" type="submit">Needs info</button>
              </form>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
