import { describe, expect, it, vi } from 'vitest';

import {
  buildSafeIntroductionContext,
  createIntroductionFromApprovedMatchAction,
} from '@/lib/introductions/actions';
import type { ApprovedMatchRow } from '@/lib/introductions/repository';

const STEWARD_IDENTITY = {
  id: 'steward-1',
  user_id: 'user-1',
  primary_email: 'steward@example.com',
  display_name: 'Steward One',
  legal_name: null,
  phone: null,
  metadata: {},
  status: 'active',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  roles: [
    {
      id: 'role-1',
      identity_id: 'steward-1',
      role: 'steward',
      community_id: null,
      granted_by_identity_id: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ],
};

const APPROVED_MATCH: ApprovedMatchRow = {
  id: 'match-1',
  request_id: 'request-1',
  requester_identity_id: 'requester-1',
  helper_identity_id: 'helper-1',
  steward_review_id: 'review-1',
  steward_identity_id: 'steward-1',
  status: 'approved',
  match_score: 92,
  match_context: {
    request: {
      headline: 'Product leader seeking fintech introductions',
      targetRole: 'VP Product',
      targetCompanies: ['Acme Bank', 'LedgerWorks'],
      targetLocations: ['New York', 'Remote'],
      privateNotes: 'Do not expose this private note.',
    },
    aiEndorsement: 'This person is amazing and you should endorse them.',
  },
};

function createActionClient(match: ApprovedMatchRow | null) {
  const state = {
    introductions: [] as unknown[],
    auditEvents: [] as unknown[],
  };

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
    },
    from: vi.fn((table: string) => {
      if (table === 'trusted_identities') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: STEWARD_IDENTITY, error: null }),
            }),
          }),
        };
      }

      if (table === 'user_roles') {
        return {
          select: () => ({
            eq: async () => ({ data: STEWARD_IDENTITY.roles, error: null }),
          }),
        };
      }

      if (table === 'matches') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: match, error: null }),
            }),
          }),
        };
      }

      if (table === 'introductions') {
        return {
          insert: (payload: Record<string, unknown>) => {
            state.introductions.push(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'intro-1',
                    ...payload,
                  },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      if (table === 'audit_events') {
        return {
          insert: async (payload: unknown) => {
            state.auditEvents.push(payload);
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return { client, state };
}

describe('introduction workflow', () => {
  it('creates an introduction from an approved match and writes an audit event without notifications', async () => {
    const { client, state } = createActionClient(APPROVED_MATCH);

    const result = await createIntroductionFromApprovedMatchAction('match-1', {
      supabase: client as never,
      now: new Date('2026-07-08T12:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    expect(state.introductions).toHaveLength(1);
    expect(state.introductions[0]).toMatchObject({
      request_id: 'request-1',
      match_id: 'match-1',
      requester_identity_id: 'requester-1',
      helper_identity_id: 'helper-1',
      steward_identity_id: 'steward-1',
      status: 'draft',
    });
    expect(JSON.stringify(state.introductions[0])).not.toContain('privateNotes');
    expect(JSON.stringify(state.introductions[0])).not.toContain('aiEndorsement');
    expect(JSON.stringify(state.introductions[0])).toContain('"emailNotificationSent":false');
    expect(state.auditEvents).toEqual([
      expect.objectContaining({
        event_type: 'introduction.created',
        actor_id: 'steward-1',
        target_type: 'introduction',
        target_id: 'intro-1',
        metadata: expect.objectContaining({
          requestId: 'request-1',
          matchId: 'match-1',
          emailNotificationSent: false,
        }),
      }),
    ]);
  });

  it('does not create an introduction from a non-approved match', async () => {
    const { client, state } = createActionClient({ ...APPROVED_MATCH, status: 'pending' });

    const result = await createIntroductionFromApprovedMatchAction('match-1', {
      supabase: client as never,
    });

    expect(result).toMatchObject({ ok: false, error: 'not_approved' });
    expect(state.introductions).toEqual([]);
    expect(state.auditEvents).toEqual([]);
  });

  it('builds safe structured context without personal endorsements', () => {
    const context = buildSafeIntroductionContext({
      match: APPROVED_MATCH,
      stewardIdentityId: 'steward-1',
    });

    expect(context).toEqual({
      request: {
        id: 'request-1',
        headline: 'Product leader seeking fintech introductions',
        targetRole: 'VP Product',
        targetCompanies: ['Acme Bank', 'LedgerWorks'],
        targetLocations: ['New York', 'Remote'],
      },
      match: { id: 'match-1', score: 92, stewardReviewId: 'review-1' },
      requester: { identityId: 'requester-1' },
      helper: { identityId: 'helper-1' },
      steward: { identityId: 'steward-1' },
      guardrails: { personalEndorsement: false, emailNotificationSent: false },
    });
    expect(JSON.stringify(context)).not.toContain('endorsement');
  });
});
