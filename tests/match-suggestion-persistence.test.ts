import { describe, expect, it, vi } from 'vitest';

import { recalculateMatchSuggestionsAction, type MatchSuggestionActionClient } from '@/lib/matching/match-actions';
import {
  listMatchSuggestionsForRequest,
  mapMatchSuggestionRow,
  replaceMatchSuggestionsForRequest,
  type MatchSuggestionRow,
} from '@/lib/matching/match-repository';

const NOW = new Date('2026-07-08T12:00:00.000Z');

function suggestionRow(overrides: Partial<MatchSuggestionRow> = {}): MatchSuggestionRow {
  return {
    id: 'suggestion-1',
    request_id: 'request-1',
    helper_identity_id: 'helper-a',
    helper_capability_id: 'capability-a',
    rank: 1,
    score: 80,
    reasons: ['Matches industry: climate.'],
    metadata: { engine: 'deterministic_v1' },
    created_at: '2026-07-08T00:00:00.000Z',
    updated_at: '2026-07-08T00:00:00.000Z',
    ...overrides,
  };
}

function createRepositoryClient(initialRows: MatchSuggestionRow[] = []) {
  const rows = [...initialRows];
  const inserts: unknown[] = [];
  const deletes: unknown[] = [];
  const filters: Array<[string, unknown]> = [];

  const client = {
    from: vi.fn((table: 'match_suggestions') => ({
      select: vi.fn().mockReturnThis(),
      insert(payload: unknown) {
        inserts.push(payload);
        return this;
      },
      delete() {
        deletes.push(table);
        return {
          eq(column: string, value: unknown) {
            filters.push([column, value]);
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return this;
      },
      order: vi.fn(async () => ({ data: rows, error: null })),
    })),
  };

  return { client, inserts, deletes, filters };
}

function createActionClient(options: { steward: boolean }) {
  const insertedSuggestions: any[] = [];
  const auditEvents: unknown[] = [];
  const deletedRequests: string[] = [];
  const suggestionRows = [suggestionRow({ helper_identity_id: 'helper-b', helper_capability_id: 'capability-b', rank: 1, score: 65 }), suggestionRow({ helper_identity_id: 'helper-a', helper_capability_id: 'capability-a', rank: 2, score: 10 })];

  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: vi.fn((table: string) => {
      if (table === 'trusted_identities') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn(async () => ({ data: { id: 'steward-1', status: 'active', user_id: 'user-1' }, error: null })) };
      }
      if (table === 'user_roles') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn(async () => ({ data: options.steward ? [{ role: 'steward', community_id: null }] : [{ role: 'member', community_id: null }], error: null })) };
      }
      if (table === 'job_seeker_requests') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn(async () => ({ data: { id: 'request-1', identity_id: 'jobseeker-1', status: 'open', headline: 'Need climate intro', target_role: 'network_introduction', target_companies: [], target_locations: ['Remote'], remote_preference: null, salary_expectation: null, work_authorization: null, notes: null, resume_url: null, created_at: NOW.toISOString(), updated_at: NOW.toISOString(), opened_at: NOW.toISOString(), closed_at: null }, error: null })) };
      }
      if (table === 'helper_capabilities') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn(async () => ({ data: [{ id: 'capability-b', identity_id: 'helper-b', categories: ['network_introduction'], availability_status: 'available', weekly_intro_capacity: 2, next_available_at: null, industries: [], geographies: ['Remote'], languages: [], private_notes: null, created_at: NOW.toISOString(), updated_at: NOW.toISOString() }, { id: 'capability-a', identity_id: 'helper-a', categories: ['resume_review'], availability_status: 'available', weekly_intro_capacity: 2, next_available_at: null, industries: [], geographies: [], languages: [], private_notes: null, created_at: NOW.toISOString(), updated_at: NOW.toISOString() }], error: null })) };
      }
      if (table === 'match_suggestions') {
        return { insert(payload: any) { insertedSuggestions.push(...payload); return this; }, select: vi.fn().mockReturnThis(), order: vi.fn(async () => ({ data: suggestionRows, error: null })), delete() { return { eq: vi.fn(async (_column: string, value: string) => { deletedRequests.push(value); return { data: null, error: null }; }) }; } };
      }
      return { insert: vi.fn(async (payload: unknown) => { auditEvents.push(payload); return { error: null }; }) };
    }),
  } as unknown as MatchSuggestionActionClient;

  return { client, insertedSuggestions, auditEvents, deletedRequests };
}

describe('match suggestion repository helpers', () => {
  it('maps persisted rows and lists suggestions by request rank', async () => {
    const { client, filters } = createRepositoryClient([suggestionRow()]);

    expect(mapMatchSuggestionRow(suggestionRow())).toMatchObject({ requestId: 'request-1', helperIdentityId: 'helper-a', score: 80 });
    await expect(listMatchSuggestionsForRequest(' request-1 ', client)).resolves.toHaveLength(1);
    expect(filters).toContainEqual(['request_id', 'request-1']);
  });

  it('replaces stale suggestions before inserting fresh suggestions', async () => {
    const { client, inserts, deletes, filters } = createRepositoryClient([suggestionRow()]);

    await replaceMatchSuggestionsForRequest('request-1', [{ helperIdentityId: 'helper-a', helperCapabilityId: 'capability-a', rank: 1, score: 80, reasons: ['Good fit.'], metadata: { engine: 'deterministic_v1' } }], client);

    expect(deletes).toEqual(['match_suggestions']);
    expect(filters).toContainEqual(['request_id', 'request-1']);
    expect(inserts[0]).toEqual([{ request_id: 'request-1', helper_identity_id: 'helper-a', helper_capability_id: 'capability-a', rank: 1, score: 80, reasons: ['Good fit.'], metadata: { engine: 'deterministic_v1' } }]);
  });
});

describe('recalculateMatchSuggestionsAction', () => {
  it('requires steward or admin authorization', async () => {
    const { client, insertedSuggestions, auditEvents } = createActionClient({ steward: false });

    await expect(recalculateMatchSuggestionsAction('request-1', { supabase: client, now: NOW })).resolves.toMatchObject({ ok: false, error: 'forbidden' });
    expect(insertedSuggestions).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it('persists deterministic ranked suggestions and writes a privacy-safe audit event', async () => {
    const { client, insertedSuggestions, auditEvents, deletedRequests } = createActionClient({ steward: true });

    const result = await recalculateMatchSuggestionsAction('request-1', { supabase: client, now: NOW });

    expect(result).toMatchObject({ ok: true });
    expect(deletedRequests).toEqual(['request-1']);
    expect(insertedSuggestions.map((suggestion) => suggestion.helper_identity_id)).toEqual(['helper-b', 'helper-a']);
    expect(insertedSuggestions[0]).toMatchObject({ rank: 1, score: 55, metadata: { engine: 'deterministic_v1', requestStatus: 'open' } });
    expect(auditEvents[0]).toMatchObject({ event_type: 'match_suggestions.recalculated', actor_id: 'steward-1', target_id: 'request-1', metadata: { suggestionCount: 2 } });
  });
});
