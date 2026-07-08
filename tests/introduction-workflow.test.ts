import { describe, expect, it, vi } from 'vitest';

import { createIntroductionFromApprovedMatchAction } from '@/lib/introductions/actions';
import type { IntroductionMatch } from '@/lib/introductions/repository';

const NOW = new Date('2026-07-08T12:00:00.000Z');

const APPROVED_MATCH: IntroductionMatch = {
  id: 'match-123',
  request_id: 'request-123',
  requester_identity_id: 'requester-123',
  helper_identity_id: 'helper-123',
  status: 'approved',
  community_id: 'community-123',
};

function createActionClient(options: {
  match?: IntroductionMatch | null;
  user?: { id: string } | null;
  identity?: { id: string; status: 'active' | 'pending'; roles: { role: 'admin' | 'steward' | 'member'; community_id: string | null }[] } | null;
}) {
  const auditEvents: unknown[] = [];
  const introductions: unknown[] = [];

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: options.user ?? null }, error: null })),
    },
    from: vi.fn((table: string) => {
      if (table === 'matches') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({ data: options.match ?? null, error: null })),
        };
      }

      if (table === 'trusted_identities') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({
            data: options.identity
              ? {
                  id: options.identity.id,
                  user_id: options.user?.id ?? null,
                  status: options.identity.status,
                  primary_email: 'steward@example.com',
                  display_name: 'Steward',
                  legal_name: null,
                  metadata: {},
                  phone: null,
                  created_at: NOW.toISOString(),
                  updated_at: NOW.toISOString(),
                }
              : null,
            error: null,
          })),
        };
      }

      if (table === 'user_roles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(async () => ({
            data: options.identity?.roles.map((role, index) => ({
              id: `role-${index}`,
              identity_id: options.identity?.id ?? 'identity-123',
              granted_by_identity_id: null,
              created_at: NOW.toISOString(),
              updated_at: NOW.toISOString(),
              ...role,
            })) ?? [],
            error: null,
          })),
        };
      }

      if (table === 'introductions') {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            introductions.push(payload);
            return {
              select: vi.fn().mockReturnThis(),
              single: vi.fn(async () => ({
                data: { id: 'intro-123', ...payload },
                error: null,
              })),
            };
          }),
        };
      }

      if (table === 'audit_events') {
        return {
          insert: vi.fn(async (payload: unknown) => {
            auditEvents.push(payload);
            return { error: null };
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return { client: client as never, auditEvents, introductions };
}

describe('createIntroductionFromApprovedMatchAction', () => {
  it('creates an introduction from an approved match', async () => {
    const { client, introductions } = createActionClient({
      match: APPROVED_MATCH,
      user: { id: 'user-123' },
      identity: { id: 'steward-123', status: 'active', roles: [{ role: 'steward', community_id: 'community-123' }] },
    });

    const result = await createIntroductionFromApprovedMatchAction('match-123', { supabase: client, now: NOW });

    expect(result).toMatchObject({ ok: true, introduction: { id: 'intro-123', match_id: 'match-123' } });
    expect(introductions).toEqual([
      expect.objectContaining({
        request_id: 'request-123',
        match_id: 'match-123',
        requester_identity_id: 'requester-123',
        helper_identity_id: 'helper-123',
        created_by_identity_id: 'steward-123',
        created_at: NOW.toISOString(),
        context: expect.objectContaining({
          summary: 'A steward-approved introduction was created from an approved match.',
          safety: { aiGeneratedEndorsement: false, emailSent: false },
        }),
      }),
    ]);
    expect(JSON.stringify(introductions)).not.toContain('endorse');
  });

  it('fails when the match is rejected', async () => {
    const { client, introductions, auditEvents } = createActionClient({
      match: { ...APPROVED_MATCH, status: 'rejected' },
      user: { id: 'user-123' },
      identity: { id: 'steward-123', status: 'active', roles: [{ role: 'admin', community_id: null }] },
    });

    await expect(createIntroductionFromApprovedMatchAction('match-123', { supabase: client, now: NOW })).resolves.toEqual({
      ok: false,
      error: 'validation',
      message: 'Introductions can only be created from approved matches.',
    });
    expect(introductions).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it('fails when the user is not a steward or admin', async () => {
    const { client, introductions, auditEvents } = createActionClient({
      match: APPROVED_MATCH,
      user: { id: 'user-123' },
      identity: { id: 'member-123', status: 'active', roles: [{ role: 'member', community_id: 'community-123' }] },
    });

    await expect(createIntroductionFromApprovedMatchAction('match-123', { supabase: client, now: NOW })).resolves.toMatchObject({
      ok: false,
      error: 'forbidden',
    });
    expect(introductions).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it('writes an audit event after creating the introduction', async () => {
    const { client, auditEvents } = createActionClient({
      match: APPROVED_MATCH,
      user: { id: 'user-123' },
      identity: { id: 'admin-123', status: 'active', roles: [{ role: 'admin', community_id: null }] },
    });

    await createIntroductionFromApprovedMatchAction('match-123', { supabase: client, now: NOW });

    expect(auditEvents).toEqual([
      expect.objectContaining({
        event_type: 'introduction.created',
        actor_type: 'user',
        actor_id: 'admin-123',
        target_type: 'introduction',
        target_id: 'intro-123',
        occurred_at: NOW.toISOString(),
        metadata: {
          requestId: 'request-123',
          matchId: 'match-123',
          requesterIdentityId: 'requester-123',
          helperIdentityId: 'helper-123',
          aiGeneratedEndorsement: false,
          emailSent: false,
        },
      }),
    ]);
  });
});
