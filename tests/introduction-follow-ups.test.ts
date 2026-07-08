import { describe, expect, it, vi } from 'vitest';

import {
  buildFollowUpAuditEvent,
  createIntroductionFollowUp,
  isFollowUpDue,
  markFollowUpCompleted,
  markFollowUpSkipped,
  type IntroductionFollowUp,
} from '@/lib/introductions/follow-ups';
import {
  completeIntroductionFollowUpAction,
  createIntroductionFollowUpAction,
  listDueIntroductionFollowUpsAction,
  skipIntroductionFollowUpAction,
  type IntroductionFollowUpActionClient,
} from '@/lib/introductions/follow-up-actions';

const NOW = new Date('2026-07-08T12:00:00.000Z');

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'follow-up-123',
    introduction_id: 'intro-123',
    created_by_identity_id: 'identity-123',
    due_at: '2026-07-08T11:00:00.000Z',
    status: 'scheduled',
    note: 'Check in',
    created_at: '2026-07-08T12:00:00.000Z',
    completed_at: null,
    skipped_at: null,
    ...overrides,
  };
}

function createClient(options: {
  user?: { id: string } | null;
  identity?: { id: string; status: 'active' | 'pending' } | null;
  introduction?: Record<string, string | null> | null;
  followUps?: ReturnType<typeof row>[];
}) {
  const auditEvents: unknown[] = [];
  const writes: unknown[] = [];
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: options.user ?? null }, error: null })) },
    from: vi.fn((table: string) => {
      if (table === 'trusted_identities') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({
            data: options.identity
              ? {
                  id: options.identity.id,
                  status: options.identity.status,
                  user_id: options.user?.id ?? null,
                }
              : null,
            error: null,
          })),
        };
      }
      if (table === 'user_roles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(async () => ({ data: [], error: null })),
        };
      }
      if (table === 'introductions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({ data: options.introduction ?? null, error: null })),
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
      return {
        insert: vi.fn((payload: unknown) => {
          writes.push(payload);
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn(async () => ({ data: row(), error: null })),
          };
        }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn(async () => ({ data: options.followUps ?? [], error: null })),
        update: vi.fn((payload: Record<string, unknown>) => {
          writes.push(payload);
          return {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn(async () => ({ data: row(payload), error: null })),
          };
        }),
      };
    }),
  } as unknown as IntroductionFollowUpActionClient;
  return { client, auditEvents, writes };
}

describe('introduction follow-up helpers', () => {
  it('normalizes reminder payloads and keeps private notes out of audit metadata', () => {
    const followUp = createIntroductionFollowUp({
      introductionId: ' intro-123 ',
      createdByIdentityId: ' identity-123 ',
      dueAt: '2026-07-09',
      note: '  Send   a thoughtful check-in. ',
      now: NOW,
    });
    expect(followUp).toMatchObject({
      introductionId: 'intro-123',
      createdByIdentityId: 'identity-123',
      dueAt: '2026-07-09T00:00:00.000Z',
      note: 'Send a thoughtful check-in.',
      status: 'scheduled',
    });
    const event = buildFollowUpAuditEvent({
      eventType: 'introduction_follow_up.created',
      actorIdentityId: 'identity-123',
      followUpId: 'follow-up-123',
      introductionId: 'intro-123',
      status: 'scheduled',
      occurredAt: NOW,
    });
    expect(JSON.stringify(event)).not.toContain('thoughtful');
  });

  it('detects only scheduled follow-ups due at or before now', () => {
    expect(isFollowUpDue({ dueAt: '2026-07-08T12:00:00.000Z', status: 'scheduled' }, NOW)).toBe(
      true,
    );
    expect(isFollowUpDue({ dueAt: '2026-07-08T12:01:00.000Z', status: 'scheduled' }, NOW)).toBe(
      false,
    );
    expect(isFollowUpDue({ dueAt: '2026-07-08T11:00:00.000Z', status: 'completed' }, NOW)).toBe(
      false,
    );
  });

  it('enforces scheduled-only status transitions', () => {
    const followUp = createIntroductionFollowUp({
      introductionId: 'intro-123',
      createdByIdentityId: 'identity-123',
      dueAt: NOW,
      now: NOW,
    });
    expect(markFollowUpCompleted(followUp, 'identity-123', NOW)).toMatchObject({
      status: 'completed',
      completedAt: '2026-07-08T12:00:00.000Z',
    });
    expect(markFollowUpSkipped(followUp, 'identity-123', NOW)).toMatchObject({
      status: 'skipped',
      skippedAt: '2026-07-08T12:00:00.000Z',
    });
    expect(() =>
      markFollowUpSkipped({ ...followUp, status: 'completed' }, 'identity-123', NOW),
    ).toThrow('Only scheduled follow-ups can be skipped.');
  });
});

describe('introduction follow-up actions', () => {
  const introduction = {
    id: 'intro-123',
    requester_identity_id: 'identity-123',
    helper_identity_id: 'helper-123',
    steward_identity_id: null,
  };

  it('requires authorization before creating reminders', async () => {
    const { client, auditEvents } = createClient({
      user: { id: 'user-123' },
      identity: { id: 'identity-999', status: 'active' },
      introduction,
    });
    await expect(
      createIntroductionFollowUpAction('intro-123', formData({ dueAt: '2026-07-09' }), {
        supabase: client,
        now: NOW,
      }),
    ).resolves.toMatchObject({ ok: false, error: 'forbidden' });
    expect(auditEvents).toEqual([]);
  });

  it('creates reminders and writes audit events', async () => {
    const { client, auditEvents, writes } = createClient({
      user: { id: 'user-123' },
      identity: { id: 'identity-123', status: 'active' },
      introduction,
    });
    await expect(
      createIntroductionFollowUpAction(
        'intro-123',
        formData({ dueAt: '2026-07-09', note: ' Private details ' }),
        { supabase: client, now: NOW },
      ),
    ).resolves.toMatchObject({ ok: true, data: { id: 'follow-up-123', status: 'scheduled' } });
    expect(writes[0]).toMatchObject({ introduction_id: 'intro-123', note: 'Private details' });
    expect(auditEvents).toEqual([
      expect.objectContaining({
        event_type: 'introduction_follow_up.created',
        metadata: { introductionId: 'intro-123', status: 'scheduled' },
      }),
    ]);
    expect(JSON.stringify(auditEvents)).not.toContain('Private details');
  });

  it('lists due follow-ups scoped to the current identity', async () => {
    const { client } = createClient({
      user: { id: 'user-123' },
      identity: { id: 'identity-123', status: 'active' },
      followUps: [row(), row({ id: 'future', due_at: '2026-07-09T12:00:00.000Z' })],
    });
    await expect(
      listDueIntroductionFollowUpsAction({ supabase: client, now: NOW }),
    ).resolves.toMatchObject({
      ok: true,
      data: [expect.objectContaining({ id: 'follow-up-123' })],
    });
  });

  it('marks reminders completed or skipped and writes audit events', async () => {
    const followUp: IntroductionFollowUp = {
      id: 'follow-up-123',
      introductionId: 'intro-123',
      createdByIdentityId: 'identity-123',
      dueAt: '2026-07-08T11:00:00.000Z',
      status: 'scheduled',
      note: null,
      createdAt: '2026-07-08T10:00:00.000Z',
      completedAt: null,
      skippedAt: null,
    };
    const completed = createClient({
      user: { id: 'user-123' },
      identity: { id: 'identity-123', status: 'active' },
      introduction,
    });
    await expect(
      completeIntroductionFollowUpAction(followUp, { supabase: completed.client, now: NOW }),
    ).resolves.toMatchObject({ ok: true, data: { status: 'completed' } });
    expect(completed.auditEvents[0]).toMatchObject({
      event_type: 'introduction_follow_up.completed',
    });

    const skipped = createClient({
      user: { id: 'user-123' },
      identity: { id: 'identity-123', status: 'active' },
      introduction,
    });
    await expect(
      skipIntroductionFollowUpAction(followUp, { supabase: skipped.client, now: NOW }),
    ).resolves.toMatchObject({ ok: true, data: { status: 'skipped' } });
    expect(skipped.auditEvents[0]).toMatchObject({ event_type: 'introduction_follow_up.skipped' });
  });
});
