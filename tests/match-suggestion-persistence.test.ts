import { beforeEach, describe, expect, it, vi } from 'vitest';

import { recalculateMatchesForRequestAction } from '@/lib/matching/match-actions';
import {
  createMatchSuggestion,
  listMatchSuggestionsForRequest,
  updateMatchSuggestionStatus,
} from '@/lib/matching/match-repository';

const mockCreateClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

const now = '2026-07-08T00:00:00.000Z';

function createChain<T>(result: { data: T; error: Error | null }) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: undefined,
  };
  return chain;
}

function createSupabaseMock(options: { authorized?: boolean } = {}) {
  const suggestions: any[] = [];
  const auditEvents: any[] = [];
  const authorized = options.authorized ?? true;
  const request = {
    id: 'request-1',
    identity_id: 'job-seeker-1',
    status: 'open',
    headline: 'Looking for platform roles',
    target_role: 'network_introduction',
    target_companies: ['Acme'],
    target_locations: ['NYC'],
    remote_preference: null,
    salary_expectation: null,
    work_authorization: null,
    notes: null,
    resume_url: null,
    created_at: now,
    updated_at: now,
    opened_at: now,
    closed_at: null,
  };
  const helpers = [
    {
      id: 'cap-2',
      identity_id: 'helper-b',
      categories: ['resume_review'],
      availability: { status: 'limited', weeklyIntroCapacity: 1 },
      industries: ['finance'],
      geographies: ['NYC'],
      languages: ['en'],
      allow_matching: true,
      relationship_strength: 1,
    },
    {
      id: 'cap-1',
      identity_id: 'helper-a',
      categories: ['network_introduction'],
      availability: { status: 'available', weeklyIntroCapacity: 3 },
      industries: ['technology'],
      geographies: ['NYC'],
      languages: ['en'],
      allow_matching: true,
      relationship_strength: 2,
    },
  ];
  const auth = {
    getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
  };

  const client = {
    auth,
    from: vi.fn((table: string) => {
      if (table === 'trusted_identities') {
        return createChain({
          data: authorized
            ? {
                id: 'steward-1',
                status: 'active',
                user_id: 'user-1',
                primary_email: 's@example.com',
              }
            : {
                id: 'member-1',
                status: 'active',
                user_id: 'user-1',
                primary_email: 'm@example.com',
              },
          error: null,
        });
      }
      if (table === 'user_roles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: [
                {
                  id: 'role-1',
                  identity_id: authorized ? 'steward-1' : 'member-1',
                  role: authorized ? 'steward' : 'member',
                  community_id: null,
                  granted_by_identity_id: null,
                  created_at: now,
                  updated_at: now,
                },
              ],
              error: null,
            })),
          })),
        };
      }
      if (table === 'job_seeker_requests') {
        return createChain({ data: request, error: null });
      }
      if (table === 'helper_capabilities') {
        return { select: vi.fn(async () => ({ data: helpers, error: null })) };
      }
      if (table === 'match_suggestions') {
        return {
          upsert: vi.fn((payload: any) => {
            const row = {
              id: `suggestion-${payload.helper_identity_id}`,
              ...payload,
              created_at: now,
              updated_at: now,
            };
            suggestions.push(row);
            return createChain({ data: row, error: null });
          }),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                order: vi.fn(async () => ({
                  data: [...suggestions].sort(
                    (left, right) =>
                      right.score - left.score ||
                      left.helper_identity_id.localeCompare(right.helper_identity_id),
                  ),
                  error: null,
                })),
              })),
            })),
          })),
          update: vi.fn((payload: any) => ({
            eq: vi.fn(() => createChain({ data: { ...suggestions[0], ...payload }, error: null })),
          })),
        };
      }
      if (table === 'audit_events') {
        return {
          insert: vi.fn(async (payload: any) => {
            auditEvents.push(payload);
            return { error: null };
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return { client, suggestions, auditEvents };
}

describe('match suggestion persistence', () => {
  beforeEach(() => mockCreateClient.mockReset());

  it('creates, lists, and updates persisted match suggestions through repository helpers', async () => {
    const supabase = createSupabaseMock();
    const created = await createMatchSuggestion(supabase.client, {
      requestId: 'request-1',
      helperIdentityId: 'helper-a',
      score: 75,
      explanation: {
        score: 75,
        reasons: ['Matches help type.'],
        signals: {
          desiredHelp: ['network_introduction'],
          targetCompanies: [],
          targetIndustries: [],
          communities: [],
          availability: 'available',
        },
      },
    });

    expect(created.helperIdentityId).toBe('helper-a');
    await expect(
      listMatchSuggestionsForRequest(supabase.client, 'request-1'),
    ).resolves.toHaveLength(1);
    await expect(
      updateMatchSuggestionStatus(supabase.client, created.id, 'dismissed'),
    ).resolves.toMatchObject({ status: 'dismissed' });
  });

  it('lets stewards recalculate deterministic suggestions with safe explanations and audit logging', async () => {
    const supabase = createSupabaseMock();
    mockCreateClient.mockReturnValueOnce(supabase.client);

    const result = await recalculateMatchesForRequestAction('request-1');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.suggestions.map((suggestion) => suggestion.helperIdentityId)).toEqual([
      'helper-a',
      'helper-b',
    ]);
    expect(result.suggestions[0].explanation).toMatchObject({
      score: result.suggestions[0].score,
      signals: { desiredHelp: ['network_introduction'], availability: 'available' },
    });
    expect(JSON.stringify(result.suggestions[0].explanation)).not.toContain('privateNotes');
    expect(supabase.auditEvents).toEqual([
      expect.objectContaining({
        event_type: 'match_suggestions.recalculated',
        actor_id: 'steward-1',
        target_type: 'job_seeker_request',
        target_id: 'request-1',
      }),
    ]);
  });

  it('prevents unauthorized users from recalculating suggestions', async () => {
    const supabase = createSupabaseMock({ authorized: false });
    mockCreateClient.mockReturnValueOnce(supabase.client);

    await expect(recalculateMatchesForRequestAction('request-1')).resolves.toMatchObject({
      ok: false,
      error: 'forbidden',
    });
    expect(supabase.suggestions).toEqual([]);
  });
});
