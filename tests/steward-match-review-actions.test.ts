import { describe, expect, it, vi } from 'vitest';

import {
  decideStewardReviewMatch,
  listStewardReviewMatches,
} from '@/lib/matching/steward-review-actions';
import type { Database } from '@/types/supabase';

type StewardReviewRow = Database['public']['Tables']['steward_reviews']['Row'];

const AUTH_USER = { id: 'user-steward' };
const STEWARD_IDENTITY = {
  id: 'identity-steward',
  user_id: AUTH_USER.id,
  primary_email: 'steward@example.com',
  display_name: 'Steward',
  legal_name: null,
  phone: null,
  status: 'active',
  metadata: {},
  created_at: '2026-07-08T00:00:00.000Z',
  updated_at: '2026-07-08T00:00:00.000Z',
} as const;

const STEWARD_ROLE = {
  id: 'role-steward',
  identity_id: 'identity-steward',
  role: 'steward',
  community_id: null,
  granted_by_identity_id: null,
  created_at: '2026-07-08T00:00:00.000Z',
  updated_at: '2026-07-08T00:00:00.000Z',
} as const;

const BASE_ROW: StewardReviewRow = {
  id: 'review-1',
  request_id: 'request-1',
  steward_identity_id: 'identity-steward',
  subject_identity_id: 'helper-1',
  status: 'pending',
  decided_at: null,
  decision_reason: null,
  match_score: 91,
  match_explanation: { reasons: ['Strong industry fit.'] },
  candidate_name: 'Helpful Helper',
  candidate_email: 'helper@example.com',
  created_at: '2026-07-08T00:00:00.000Z',
  updated_at: '2026-07-08T00:00:00.000Z',
};

function createClient(row: StewardReviewRow | null = BASE_ROW) {
  const state = { rows: row ? [row] : [], updates: [] as unknown[], auditEvents: [] as unknown[] };

  const filterRows = (filters: Record<string, string>) =>
    state.rows.filter((item) =>
      Object.entries(filters).every(
        ([key, value]) => item[key as keyof StewardReviewRow] === value,
      ),
    );

  const client = {
    auth: {
      getUser: vi.fn(async (): Promise<{ data: { user: { id: string } | null }; error: null }> => ({
        data: { user: AUTH_USER },
        error: null,
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'trusted_identities') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: STEWARD_IDENTITY, error: null }) }),
          }),
        };
      }
      if (table === 'user_roles') {
        return { select: () => ({ eq: async () => ({ data: [STEWARD_ROLE], error: null }) }) };
      }
      if (table === 'audit_events') {
        return {
          insert: vi.fn(async (payload) => {
            state.auditEvents.push(payload);
            return { error: null };
          }),
        };
      }

      let filters: Record<string, string> = {};
      return {
        select: () => ({
          eq(column: string, value: string) {
            filters[column] = value;
            return this;
          },
          order: async () => ({ data: filterRows(filters), error: null }),
          single: async () => ({ data: filterRows(filters)[0] ?? null, error: null }),
          then(resolve: (value: unknown) => unknown) {
            return Promise.resolve({ data: filterRows(filters), error: null }).then(resolve);
          },
        }),
        update(values: Partial<StewardReviewRow>) {
          state.updates.push(values);
          return {
            eq(column: string, value: string) {
              filters[column] = value;
              return this;
            },
            select() {
              return this;
            },
            single: async () => {
              const existing = filterRows(filters)[0];
              const updated = existing ? { ...existing, ...values } : null;
              return { data: updated, error: null };
            },
          };
        },
      };
    }),
  };

  return { client, state };
}

describe('steward match review actions', () => {
  it('lists suggested matches for steward review without exposing notes beyond match metadata', async () => {
    const { client } = createClient();

    await expect(
      listStewardReviewMatches('request-1', { supabase: client as never }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'review-1', matchScore: 91, candidateName: 'Helpful Helper' }),
    ]);
  });

  it('approves a pending match suggestion, persists the decision, and writes safe audit metadata', async () => {
    const { client, state } = createClient();

    const result = await decideStewardReviewMatch(
      { requestId: 'request-1', reviewId: 'review-1', intent: 'approve', reason: ' Good fit. ' },
      { supabase: client as never, now: new Date('2026-07-08T12:00:00.000Z'), revalidate: false },
    );

    expect(result).toEqual({
      ok: true,
      review: expect.objectContaining({ status: 'approved', decisionReason: 'Good fit.' }),
    });
    expect(state.updates).toEqual([
      { status: 'approved', decided_at: '2026-07-08T12:00:00.000Z', decision_reason: 'Good fit.' },
    ]);
    expect(state.auditEvents).toEqual([
      expect.objectContaining({
        event_type: 'steward_review.approved',
        actor_id: 'identity-steward',
        target_type: 'steward_review',
        target_id: 'review-1',
        metadata: expect.objectContaining({ hasReason: true, reasonLength: 9 }),
      }),
    ]);
    expect(JSON.stringify(state.auditEvents)).not.toContain('Good fit.');
  });

  it('returns a safe auth failure for anonymous users', async () => {
    const { client } = createClient();
    client.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    await expect(
      decideStewardReviewMatch(
        { requestId: 'request-1', reviewId: 'review-1', intent: 'reject' },
        { supabase: client as never, revalidate: false },
      ),
    ).resolves.toMatchObject({ ok: false, error: 'auth_required' });
  });
});
