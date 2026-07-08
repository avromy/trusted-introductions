import { describe, expect, it } from 'vitest';
import { reviewMatchSuggestionAction } from '@/lib/matching/steward-review-actions';
import type { PersistedMatchSuggestion } from '@/lib/matching/steward-review-actions';

const steward = {
  id: 'steward-1',
  user_id: 'user-1',
  primary_email: 'steward@example.com',
  display_name: 'Steward',
  legal_name: null,
  phone: null,
  status: 'active',
  metadata: {},
  created_at: '2026-07-08T00:00:00.000Z',
  updated_at: '2026-07-08T00:00:00.000Z',
  roles: [{ id: 'role-1', identity_id: 'steward-1', role: 'steward', community_id: null, granted_by_identity_id: null, created_at: '2026-07-08T00:00:00.000Z', updated_at: '2026-07-08T00:00:00.000Z' }],
};

const suggestion: PersistedMatchSuggestion = {
  id: 'suggestion-1',
  request_id: 'request-1',
  helper_identity_id: 'helper-1',
  score: 87,
  explanation: { reasons: ['Matches company: openai.', 'Helper is available.'] },
  review_status: 'pending',
  reviewed_by_identity_id: null,
  reviewed_at: null,
  review_reason: null,
  created_at: '2026-07-08T00:00:00.000Z',
  updated_at: '2026-07-08T00:00:00.000Z',
};

function createClient(existing: PersistedMatchSuggestion | null, user: { id: string } | null = { id: 'user-1' }) {
  const auditPayloads: unknown[] = [];
  const client = {
    auditPayloads,
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table: string) {
      if (table === 'trusted_identities') {
        const { roles: _roles, ...identity } = steward;
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: identity, error: null }) }) }) };
      }
      if (table === 'user_roles') {
        return { select: () => ({ eq: () => Promise.resolve({ data: steward.roles, error: null }) }) };
      }
      if (table === 'match_suggestions') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }),
          update: (payload: Partial<PersistedMatchSuggestion>) => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: existing ? { ...existing, ...payload, updated_at: '2026-07-08T00:01:00.000Z' } : null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'audit_events') {
        return { insert: async (payload: unknown) => { auditPayloads.push(payload); return { error: null }; } };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
  return client;
}

describe('steward match review actions', () => {
  it('approves a persisted suggestion and writes privacy-safe audit metadata', async () => {
    const client = createClient(suggestion);
    const result = await reviewMatchSuggestionAction(
      { suggestionId: 'suggestion-1', decision: 'approved', reason: 'Strong private context' },
      client as never,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.suggestion.review_status).toBe('approved');
      expect(result.suggestion.review_reason).toBe('Strong private context');
      expect(result.suggestion.reviewed_by_identity_id).toBe('steward-1');
    }
    expect(client.auditPayloads).toEqual([
      expect.objectContaining({
        event_type: 'match_suggestion.approved',
        actor_identity_id: 'steward-1',
        subject_table: 'match_suggestions',
        subject_id: 'suggestion-1',
        metadata: expect.objectContaining({
          requestId: 'request-1',
          helperIdentityId: 'helper-1',
          previousStatus: 'pending',
          status: 'approved',
          hasReason: true,
          reasonLength: 22,
        }),
      }),
    ]);
    expect(JSON.stringify(client.auditPayloads)).not.toContain('Strong private context');
  });

  it('denies unauthenticated users safely', async () => {
    const result = await reviewMatchSuggestionAction(
      { suggestionId: 'suggestion-1', decision: 'approved' },
      createClient(suggestion, null) as never,
    );

    expect(result).toEqual({ ok: false, error: 'auth_required', message: 'Authentication is required.' });
  });

  it('rejects unsupported decisions and final-status changes', async () => {
    await expect(
      reviewMatchSuggestionAction({ suggestionId: 'suggestion-1', decision: 'maybe' }, createClient(suggestion) as never),
    ).resolves.toMatchObject({ ok: false, error: 'invalid_request' });

    await expect(
      reviewMatchSuggestionAction(
        { suggestionId: 'suggestion-1', decision: 'rejected' },
        createClient({ ...suggestion, review_status: 'approved' }) as never,
      ),
    ).resolves.toMatchObject({ ok: false, error: 'invalid_request' });
  });
});
