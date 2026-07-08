import { describe, expect, it, vi } from 'vitest';

import {
  createIntroductionAction,
  sendIntroductionAction,
  type IntroductionActionClient,
} from '@/lib/introductions/actions';
import {
  createIntroduction,
  getIntroductionById,
  markIntroductionSent,
  type IntroductionRow,
} from '@/lib/introductions/repository';

const NOW = new Date('2026-07-08T12:00:00.000Z');

function row(overrides: Partial<IntroductionRow> = {}): IntroductionRow {
  return {
    id: 'introduction-123',
    match_id: 'review-123',
    requester_identity_id: 'identity-seeker',
    helper_identity_id: 'identity-helper',
    steward_identity_id: 'identity-steward',
    status: 'created',
    steward_note: 'Warm context',
    created_at: '2026-07-08T12:00:00.000Z',
    updated_at: '2026-07-08T12:00:00.000Z',
    sent_at: null,
    ...overrides,
  };
}

function createRepositoryClient(initialRows: IntroductionRow[] = []) {
  const rows = [...initialRows];
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const filters: Array<[string, unknown]> = [];

  const client = {
    from: vi.fn((table: 'introductions') => ({
      select: vi.fn().mockReturnThis(),
      insert(payload: unknown) {
        inserts.push(payload);
        return this;
      },
      update(payload: unknown) {
        updates.push(payload);
        return this;
      },
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return this;
      },
      maybeSingle: vi.fn(async () => ({ data: rows[0] ?? null, error: null })),
      single: vi.fn(async () => ({ data: rows[0] ?? row(), error: null })),
    })),
  };

  return { client, inserts, updates, filters };
}

function createActionClient(options: {
  user?: { id: string; email?: string } | null;
  identity?: { id: string; status: 'active' | 'pending' } | null;
  roles?: Array<{ role: 'member' | 'steward' | 'admin'; community_id: string | null }>;
}) {
  const introductionRows = [row()];
  const insertedIntroductions: unknown[] = [];
  const updatedIntroductions: unknown[] = [];
  const auditEvents: unknown[] = [];

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: options.user ?? null }, error: null })),
    },
    from: vi.fn((table: 'trusted_identities' | 'user_roles' | 'introductions' | 'audit_events') => {
      if (table === 'trusted_identities') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({
            data: options.identity
              ? { id: options.identity.id, status: options.identity.status, user_id: options.user?.id }
              : null,
            error: null,
          })),
        };
      }

      if (table === 'user_roles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(async () => ({ data: options.roles ?? [], error: null })),
        };
      }

      if (table === 'introductions') {
        return {
          insert(payload: unknown) {
            insertedIntroductions.push(payload);
            return this;
          },
          update(payload: unknown) {
            updatedIntroductions.push(payload);
            return this;
          },
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn(async () => ({ data: introductionRows[0], error: null })),
        };
      }

      return {
        insert: vi.fn(async (payload: unknown) => {
          auditEvents.push(payload);
          return { error: null };
        }),
      };
    }),
  } as unknown as IntroductionActionClient;

  return { client, insertedIntroductions, updatedIntroductions, auditEvents };
}

describe('introduction repository helpers', () => {
  it('creates an introduction from a steward-approved match', async () => {
    const { client, inserts } = createRepositoryClient([row()]);

    await expect(
      createIntroduction(
        {
          matchId: ' review-123 ',
          requesterIdentityId: ' identity-seeker ',
          helperIdentityId: ' identity-helper ',
          stewardIdentityId: ' identity-steward ',
          stewardNote: ' Warm context ',
          now: NOW,
        },
        client,
      ),
    ).resolves.toMatchObject({ id: 'introduction-123', status: 'created' });

    expect(inserts[0]).toMatchObject({
      match_id: 'review-123',
      requester_identity_id: 'identity-seeker',
      helper_identity_id: 'identity-helper',
      steward_identity_id: 'identity-steward',
      status: 'created',
      steward_note: 'Warm context',
      created_at: '2026-07-08T12:00:00.000Z',
    });
  });

  it('reads an introduction and marks it sent', async () => {
    const { client, updates, filters } = createRepositoryClient([row({ status: 'sent' })]);

    await expect(getIntroductionById('introduction-123', client)).resolves.toMatchObject({
      id: 'introduction-123',
    });
    await expect(markIntroductionSent('introduction-123', client, NOW)).resolves.toMatchObject({
      status: 'sent',
    });

    expect(filters).toContainEqual(['id', 'introduction-123']);
    expect(updates[0]).toMatchObject({
      status: 'sent',
      sent_at: '2026-07-08T12:00:00.000Z',
    });
  });
});

describe('introduction server actions', () => {
  it('requires a steward or admin identity', async () => {
    const { client, insertedIntroductions, auditEvents } = createActionClient({
      user: { id: 'user-123' },
      identity: { id: 'identity-member', status: 'active' },
      roles: [{ role: 'member', community_id: null }],
    });

    await expect(createIntroductionAction({}, { supabase: client })).resolves.toMatchObject({
      ok: false,
      error: 'forbidden',
    });
    expect(insertedIntroductions).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it('validates required match participants without persisting', async () => {
    const { client, insertedIntroductions, auditEvents } = createActionClient({
      user: { id: 'user-123' },
      identity: { id: 'identity-steward', status: 'active' },
      roles: [{ role: 'steward', community_id: null }],
    });

    await expect(createIntroductionAction({}, { supabase: client })).resolves.toMatchObject({
      ok: false,
      error: 'validation',
    });
    expect(insertedIntroductions).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it('creates and audits an introduction for a steward-approved match', async () => {
    const { client, insertedIntroductions, auditEvents } = createActionClient({
      user: { id: 'user-123' },
      identity: { id: 'identity-steward', status: 'active' },
      roles: [{ role: 'steward', community_id: null }],
    });

    const result = await createIntroductionAction(
      {
        matchId: 'review-123',
        requesterIdentityId: 'identity-seeker',
        helperIdentityId: 'identity-helper',
        stewardNote: 'Warm context',
      },
      { supabase: client, now: NOW },
    );

    expect(result).toMatchObject({ ok: true, introduction: { id: 'introduction-123' } });
    expect(insertedIntroductions[0]).toMatchObject({
      match_id: 'review-123',
      steward_identity_id: 'identity-steward',
    });
    expect(auditEvents).toContainEqual(
      expect.objectContaining({
        event_type: 'introduction.created',
        actor_id: 'identity-steward',
        target_id: 'introduction-123',
      }),
    );
  });

  it('sends and audits an introduction', async () => {
    const { client, updatedIntroductions, auditEvents } = createActionClient({
      user: { id: 'user-123' },
      identity: { id: 'identity-steward', status: 'active' },
      roles: [{ role: 'admin', community_id: null }],
    });

    await expect(sendIntroductionAction('introduction-123', { supabase: client, now: NOW })).resolves.toMatchObject({
      ok: true,
      introduction: { id: 'introduction-123' },
    });
    expect(updatedIntroductions[0]).toMatchObject({ status: 'sent' });
    expect(auditEvents).toContainEqual(expect.objectContaining({ event_type: 'introduction.sent' }));
  });
});
