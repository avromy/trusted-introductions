import { describe, expect, it, vi } from 'vitest';

import {
  recalculateMatchSuggestionsAction,
  type MatchSuggestionActionClient,
} from '@/lib/matching/match-actions';
import {
  listMatchSuggestionsForRequest,
  replaceMatchSuggestionsForRequest,
  type MatchSuggestionRow,
} from '@/lib/matching/match-repository';
import type { JobSeekerRequestRow } from '@/lib/matching/job-seeker-repository';
import type { Database } from '@/types/supabase';

type TrustedIdentityRow = Database['public']['Tables']['trusted_identities']['Row'];
type UserRoleRow = Database['public']['Tables']['user_roles']['Row'];

const NOW = new Date('2026-07-08T12:00:00.000Z');

function suggestionRow(overrides: Partial<MatchSuggestionRow> = {}): MatchSuggestionRow {
  return {
    id: 'suggestion-1',
    request_id: 'request-1',
    helper_identity_id: 'helper-1',
    score: 85,
    explanation: { score: 85, reasons: ['Matches company: acme.'] },
    status: 'suggested',
    recalculated_by_identity_id: 'steward-1',
    recalculated_at: NOW.toISOString(),
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function requestRow(overrides: Partial<JobSeekerRequestRow> = {}): JobSeekerRequestRow {
  return {
    id: 'request-1',
    identity_id: 'seeker-1',
    status: 'open',
    headline: 'Seeking intros',
    target_role: 'Product Lead',
    target_companies: ['Acme'],
    target_locations: ['Remote'],
    remote_preference: null,
    salary_expectation: null,
    work_authorization: null,
    notes: null,
    resume_url: null,
    opened_at: NOW.toISOString(),
    closed_at: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

const stewardIdentity: TrustedIdentityRow = {
  id: 'steward-1',
  user_id: 'user-1',
  primary_email: 'steward@example.com',
  display_name: 'Steward',
  legal_name: null,
  phone: null,
  metadata: {},
  status: 'active',
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
};

function role(roleName: UserRoleRow['role']): UserRoleRow {
  return {
    id: `${roleName}-role`,
    identity_id: stewardIdentity.id,
    community_id: null,
    role: roleName,
    granted_by_identity_id: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
  };
}

function createRepositoryClient(rows: MatchSuggestionRow[] = []) {
  const inserts: unknown[] = [];
  const deletes: string[] = [];
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
        return this;
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

function createActionClient(options: { stewardRole?: UserRoleRow['role'] | null } = {}) {
  const persistedRows = [suggestionRow()];
  const insertedSuggestions: unknown[] = [];
  const auditEvents: unknown[] = [];

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
    },
    from: vi.fn((table: string) => {
      if (table === 'trusted_identities') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({ data: stewardIdentity, error: null })),
        };
      }

      if (table === 'user_roles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(async () => ({
            data:
              options.stewardRole === null
                ? [role('member')]
                : [role(options.stewardRole ?? 'steward')],
            error: null,
          })),
        };
      }

      if (table === 'job_seeker_requests') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({ data: requestRow(), error: null })),
        };
      }

      if (table === 'match_suggestions') {
        return {
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn(async () => ({ data: [], error: null })),
          insert(payload: unknown) {
            insertedSuggestions.push(payload);
            return this;
          },
          select: vi.fn().mockReturnThis(),
        };
      }

      return {
        insert: vi.fn(async (payload: unknown) => {
          auditEvents.push(payload);
          return { error: null };
        }),
      };
    }),
  } as unknown as MatchSuggestionActionClient;

  return { client, insertedSuggestions, auditEvents, persistedRows };
}

describe('match suggestion repository helpers', () => {
  it('lists persisted explainable suggestions for a request', async () => {
    const { client, filters } = createRepositoryClient([suggestionRow()]);

    await expect(listMatchSuggestionsForRequest('request-1', client)).resolves.toEqual([
      expect.objectContaining({ requestId: 'request-1', helperIdentityId: 'helper-1', score: 85 }),
    ]);
    expect(filters).toContainEqual(['request_id', 'request-1']);
  });

  it('replaces stale suggestions with newly ranked explanations', async () => {
    const { client, inserts, deletes } = createRepositoryClient([suggestionRow()]);

    await replaceMatchSuggestionsForRequest(
      {
        requestId: 'request-1',
        recalculatedByIdentityId: 'steward-1',
        recalculatedAt: NOW,
        suggestions: [
          {
            id: 'helper-1',
            matchScore: 85,
            matchExplanation: { score: 85, reasons: ['Matches company: acme.'] },
          },
        ],
      },
      client,
    );

    expect(deletes).toEqual(['match_suggestions']);
    expect(inserts[0]).toEqual([
      expect.objectContaining({
        request_id: 'request-1',
        helper_identity_id: 'helper-1',
        score: 85,
        status: 'suggested',
        recalculated_by_identity_id: 'steward-1',
        recalculated_at: NOW.toISOString(),
      }),
    ]);
  });
});

describe('recalculateMatchSuggestionsAction', () => {
  it('requires steward or admin authorization', async () => {
    const { client, insertedSuggestions, auditEvents } = createActionClient({ stewardRole: null });

    await expect(
      recalculateMatchSuggestionsAction(
        { requestId: 'request-1', helperCandidates: [] },
        { supabase: client },
      ),
    ).resolves.toMatchObject({ ok: false, error: 'forbidden' });
    expect(insertedSuggestions).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it('persists ranked suggestions and writes a steward audit event', async () => {
    const { client, insertedSuggestions, auditEvents } = createActionClient();

    const result = await recalculateMatchSuggestionsAction(
      {
        requestId: 'request-1',
        desiredHelp: ['network_introduction'],
        targetIndustries: ['software'],
        communities: ['founders'],
        helperCandidates: [
          {
            id: 'helper-1',
            helpTypes: ['network_introduction'],
            companies: ['Acme'],
            industries: ['software'],
            communities: ['founders'],
            availability: 'available',
            relationshipStrength: 2,
          },
        ],
      },
      { supabase: client, now: NOW },
    );

    expect(result).toEqual({ ok: true, suggestions: [] });
    expect(insertedSuggestions[0]).toEqual([
      expect.objectContaining({
        request_id: 'request-1',
        helper_identity_id: 'helper-1',
        score: 100,
        explanation: expect.objectContaining({
          reasons: expect.arrayContaining(['Matches company: acme.']),
        }),
      }),
    ]);
    expect(auditEvents).toEqual([
      expect.objectContaining({
        event_type: 'match_suggestions.recalculated',
        actor_id: 'steward-1',
        target_id: 'request-1',
      }),
    ]);
  });
});
