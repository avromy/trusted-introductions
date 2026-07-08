import { describe, expect, it, vi } from 'vitest';

import {
  createIntroductionFollowUpAction,
  listDueIntroductionFollowUpsAction,
  updateIntroductionFollowUpStatusAction,
  type IntroductionFollowUpSupabaseClient,
} from '@/lib/introductions/follow-up-actions';
import {
  createIntroductionFollowUpPayload,
  createIntroductionFollowUpStatusUpdate,
  isDueFollowUp,
} from '@/lib/introductions/follow-ups';
import type { Database } from '@/types/supabase';

const NOW = new Date('2026-07-08T12:00:00.000Z');

type IntroductionRow = Database['public']['Tables']['introductions']['Row'];
type FollowUpRow = Database['public']['Tables']['introduction_follow_ups']['Row'];

const USER = {
  id: 'user-123',
  identities: [{ identity_id: 'identity-helper', provider: 'email' }],
};

function introduction(overrides: Partial<IntroductionRow> = {}): IntroductionRow {
  return {
    id: 'intro-123',
    community_id: 'community-123',
    requester_identity_id: 'identity-requester',
    helper_identity_id: 'identity-helper',
    recipient_identity_id: 'identity-recipient',
    status: 'accepted',
    created_at: '2026-07-07T12:00:00.000Z',
    updated_at: '2026-07-07T12:00:00.000Z',
    ...overrides,
  };
}

function followUp(overrides: Partial<FollowUpRow> = {}): FollowUpRow {
  return {
    id: 'follow-up-123',
    introduction_id: 'intro-123',
    due_at: '2026-07-08T11:00:00.000Z',
    status: 'pending',
    note: 'Check whether the intro happened.',
    created_by_identity_id: 'identity-helper',
    completed_at: null,
    completed_by_identity_id: null,
    skipped_at: null,
    skipped_by_identity_id: null,
    created_at: '2026-07-08T10:00:00.000Z',
    updated_at: '2026-07-08T10:00:00.000Z',
    ...overrides,
  };
}

function mockClient(options: {
  user?: typeof USER | null;
  introductions?: Record<string, IntroductionRow | null>;
  followUps?: FollowUpRow[];
  selectedFollowUp?: FollowUpRow | null;
  insertedFollowUp?: FollowUpRow;
  updatedFollowUp?: FollowUpRow;
} = {}) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const auditEvents: unknown[] = [];
  const introductions = options.introductions ?? { 'intro-123': introduction() };
  const followUps = options.followUps ?? [];

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: options.user === undefined ? USER : options.user }, error: null })),
    },
    from: vi.fn((table: 'introductions' | 'introduction_follow_ups' | 'audit_events') => {
      if (table === 'audit_events') {
        return { insert: async (payload: unknown) => { auditEvents.push(payload); return { error: null }; } };
      }

      if (table === 'introductions') {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              single: async () => {
                const row = introductions[value] ?? null;
                return { data: row, error: row ? null : { message: 'not found' } };
              },
            }),
          }),
        };
      }

      return {
        insert: (payload: unknown) => {
          inserts.push(payload);
          return { select: () => ({ single: async () => ({ data: options.insertedFollowUp ?? followUp(), error: null }) }) };
        },
        update: (payload: unknown) => {
          updates.push(payload);
          return { eq: () => ({ select: () => ({ single: async () => ({ data: options.updatedFollowUp ?? followUp({ status: 'completed', completed_at: NOW.toISOString(), completed_by_identity_id: 'identity-helper', updated_at: NOW.toISOString() }), error: null }) }) }) };
        },
        select: () => ({
          eq: (_column: string, value: string) => ({
            single: async () => ({ data: options.selectedFollowUp ?? followUp({ id: value }), error: options.selectedFollowUp === null ? { message: 'not found' } : null }),
          }),
          lte: () => ({
            eq: () => ({
              order: async () => ({ data: followUps, error: null }),
            }),
          }),
        }),
      };
    }),
  } as unknown as IntroductionFollowUpSupabaseClient;

  return { client, inserts, updates, auditEvents };
}

describe('introduction follow-up model helpers', () => {
  it('creates pending follow-up payloads and due checks', () => {
    const payload = createIntroductionFollowUpPayload({
      introductionId: ' intro-123 ',
      dueAt: '2026-07-08T11:00:00.000Z',
      note: '  Circle back  ',
      createdByIdentityId: ' identity-helper ',
      now: NOW,
    });

    expect(payload).toMatchObject({
      introduction_id: 'intro-123',
      due_at: '2026-07-08T11:00:00.000Z',
      status: 'pending',
      note: 'Circle back',
      created_by_identity_id: 'identity-helper',
    });
    expect(isDueFollowUp(followUp(), NOW)).toBe(true);
    expect(isDueFollowUp(followUp({ due_at: '2026-07-08T13:00:00.000Z' }), NOW)).toBe(false);
  });

  it('builds safe terminal status updates', () => {
    expect(createIntroductionFollowUpStatusUpdate({ status: 'skipped', actorIdentityId: 'identity-helper', now: NOW })).toMatchObject({
      status: 'skipped',
      skipped_at: NOW.toISOString(),
      skipped_by_identity_id: 'identity-helper',
      completed_at: null,
      completed_by_identity_id: null,
    });
  });
});

describe('introduction follow-up server helpers', () => {
  it('creates a reminder for an authorized introduction participant and writes audit', async () => {
    const { client, inserts, auditEvents } = mockClient();

    await expect(createIntroductionFollowUpAction({ introductionId: ' intro-123 ', dueAt: '2026-07-09T12:00:00.000Z', note: ' Check in ' }, { supabase: client, now: NOW })).resolves.toMatchObject({ ok: true });

    expect(inserts).toEqual([expect.objectContaining({ introduction_id: 'intro-123', due_at: '2026-07-09T12:00:00.000Z', note: 'Check in' })]);
    expect(auditEvents).toEqual([expect.objectContaining({ event_type: 'introduction_follow_up.created', actor_id: 'identity-helper', target_type: 'introduction_follow_up' })]);
  });

  it('blocks reminder creation by non-participants', async () => {
    const { client, inserts, auditEvents } = mockClient({ user: { ...USER, identities: [{ identity_id: 'identity-outsider', provider: 'email' }] } });

    await expect(createIntroductionFollowUpAction({ introductionId: 'intro-123', dueAt: NOW }, { supabase: client, now: NOW })).resolves.toEqual({
      ok: false,
      error: 'forbidden',
      message: 'You are not allowed to manage follow-ups for this introduction.',
    });
    expect(inserts).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it('marks a reminder completed and writes audit', async () => {
    const { client, updates, auditEvents } = mockClient();

    await expect(updateIntroductionFollowUpStatusAction('follow-up-123', 'completed', { supabase: client, now: NOW })).resolves.toMatchObject({ ok: true });

    expect(updates).toEqual([expect.objectContaining({ status: 'completed', completed_at: NOW.toISOString(), completed_by_identity_id: 'identity-helper' })]);
    expect(auditEvents).toEqual([expect.objectContaining({ event_type: 'introduction_follow_up.completed', actor_id: 'identity-helper' })]);
  });

  it('lists due reminders visible to the authenticated introduction participant', async () => {
    const visible = followUp({ id: 'visible', introduction_id: 'intro-123' });
    const hidden = followUp({ id: 'hidden', introduction_id: 'intro-hidden' });
    const { client } = mockClient({
      followUps: [visible, hidden],
      introductions: {
        'intro-123': introduction(),
        'intro-hidden': introduction({ id: 'intro-hidden', helper_identity_id: 'identity-other' }),
      },
    });

    await expect(listDueIntroductionFollowUpsAction({ supabase: client, now: NOW })).resolves.toEqual({
      ok: true,
      followUps: [visible],
    });
  });
});
