import { describe, expect, it, vi } from 'vitest';

import {
  decideStewardMatchReview,
  recalculateStewardMatchReview,
  type StewardMatchReviewClient,
} from '@/lib/matching/steward-review-actions';
import type { Database } from '@/types/supabase';

type IdentityRow = Database['public']['Tables']['trusted_identities']['Row'];
type RoleRow = Database['public']['Tables']['user_roles']['Row'];
type SuggestionRow = Database['public']['Tables']['match_suggestions']['Row'];
type ReviewRow = Database['public']['Tables']['steward_reviews']['Row'];
type TableName =
  'trusted_identities' | 'user_roles' | 'match_suggestions' | 'steward_reviews' | 'audit_events';

const identity: IdentityRow = {
  id: 'identity-steward',
  user_id: 'user-1',
  primary_email: 'steward@example.com',
  display_name: 'Steward',
  legal_name: null,
  phone: null,
  metadata: {},
  status: 'active',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const stewardRole: RoleRow = {
  id: 'role-1',
  identity_id: identity.id,
  role: 'steward',
  community_id: null,
  granted_by_identity_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const suggestion: SuggestionRow = {
  id: 'suggestion-1',
  request_id: 'request-1',
  helper_identity_id: 'helper-1',
  match_score: 88,
  match_explanation: { score: 88, reasons: ['Industry match', 'Location match'] },
  status: 'pending',
  steward_review_id: null,
  reviewed_at: null,
  created_at: '2026-01-02T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

function createClient(
  options: {
    user?: { id: string } | null;
    roles?: RoleRow[];
    suggestion?: SuggestionRow | null;
    review?: ReviewRow | null;
  } = {},
) {
  const state = {
    suggestions:
      options.suggestion === undefined
        ? [structuredClone(suggestion)]
        : options.suggestion
          ? [options.suggestion]
          : [],
    reviews: options.review ? [options.review] : ([] as ReviewRow[]),
    auditEvents: [] as unknown[],
  };

  function rows(table: TableName): unknown[] {
    if (table === 'trusted_identities') return [identity];
    if (table === 'user_roles') return options.roles ?? [stewardRole];
    if (table === 'match_suggestions') return state.suggestions;
    if (table === 'steward_reviews') return state.reviews;
    return state.auditEvents;
  }

  function builder(table: TableName) {
    const filters: Array<[string, unknown]> = [];
    let pendingInsert: unknown;
    let pendingUpdate: Record<string, unknown> | null = null;

    const applyFilters = () =>
      rows(table).filter((row) =>
        filters.every(([key, value]) => (row as Record<string, unknown>)[key] === value),
      );
    const api = {
      select: vi.fn(() => api),
      insert: vi.fn((payload: unknown) => {
        if (table === 'audit_events') {
          state.auditEvents.push(payload);
          return Promise.resolve({ error: null });
        }
        pendingInsert = payload;
        return api;
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        pendingUpdate = payload;
        return api;
      }),
      eq: vi.fn((column: string, value: unknown) => {
        filters.push([column, value]);
        return api;
      }),
      order: vi.fn(async () => ({ data: applyFilters(), error: null })),
      maybeSingle: vi.fn(async () => ({ data: applyFilters()[0] ?? null, error: null })),
      then: (
        resolve: (value: { data: unknown[]; error: null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: applyFilters(), error: null }).then(resolve, reject),
      single: vi.fn(async () => {
        if (pendingInsert && table === 'steward_reviews') {
          const review = {
            id: 'review-1',
            created_at: '2026-01-03T00:00:00.000Z',
            updated_at: '2026-01-03T00:00:00.000Z',
            ...(pendingInsert as Record<string, unknown>),
          } as ReviewRow;
          state.reviews.push(review);
          return { data: review, error: null };
        }
        if (pendingUpdate) {
          const row = applyFilters()[0] as Record<string, unknown> | undefined;
          if (row) Object.assign(row, pendingUpdate);
          return { data: row, error: null };
        }
        return { data: applyFilters()[0], error: null };
      }),
    };
    return api;
  }

  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options.user === null ? null : (options.user ?? { id: 'user-1' }) },
        error: null,
      })),
    },
    from: vi.fn((table: TableName) => builder(table)),
  } as unknown as StewardMatchReviewClient;

  return { client, state };
}

describe('steward match review actions', () => {
  it('persists authorized steward approvals and writes privacy-safe audit metadata', async () => {
    const { client, state } = createClient();
    const result = await decideStewardMatchReview(
      { matchSuggestionId: suggestion.id, decision: 'approved', reason: 'Sensitive context' },
      client,
    );

    expect(result.ok).toBe(true);
    expect(state.reviews[0]).toMatchObject({
      status: 'approved',
      steward_identity_id: identity.id,
    });
    expect(state.suggestions[0]).toMatchObject({
      status: 'approved',
      steward_review_id: 'review-1',
    });
    expect(state.auditEvents).toHaveLength(1);
    expect(state.auditEvents[0]).toMatchObject({
      event_type: 'steward_match_review.approved',
      actor_id: identity.id,
      metadata: expect.objectContaining({
        hasPrivateDecisionReason: true,
        decisionReasonLength: 17,
      }),
    });
    expect(JSON.stringify(state.auditEvents)).not.toContain('Sensitive context');
  });

  it('rejects unauthorized users before persistence', async () => {
    const { client, state } = createClient({ roles: [] });
    const result = await decideStewardMatchReview(
      { matchSuggestionId: suggestion.id, decision: 'rejected' },
      client,
    );

    expect(result).toMatchObject({ ok: false, error: 'forbidden' });
    expect(state.reviews).toEqual([]);
    expect(state.auditEvents).toEqual([]);
  });

  it('prevents changes from final states', async () => {
    const finalSuggestion = { ...suggestion, status: 'approved' as const };
    const { client, state } = createClient({ suggestion: finalSuggestion });
    const result = await decideStewardMatchReview(
      { matchSuggestionId: suggestion.id, decision: 'rejected' },
      client,
    );

    expect(result).toMatchObject({ ok: false, error: 'invalid_transition' });
    expect(state.auditEvents).toEqual([]);
  });

  it('allows needs_info to approved transition and audits recalculate requests', async () => {
    const needsInfo = { ...suggestion, status: 'needs_info' as const };
    const { client, state } = createClient({ suggestion: needsInfo });

    await expect(
      decideStewardMatchReview({ matchSuggestionId: suggestion.id, decision: 'approved' }, client),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      recalculateStewardMatchReview({ requestId: suggestion.request_id }, client),
    ).resolves.toMatchObject({ ok: true });

    expect(state.auditEvents).toHaveLength(2);
    expect(state.auditEvents[1]).toMatchObject({ event_type: 'steward_match_review.recalculated' });
  });
});
