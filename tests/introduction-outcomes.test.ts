import { describe, expect, it, vi } from 'vitest';

import {
  INTRODUCTION_OUTCOME_VALUES,
  captureIntroductionOutcome,
  isIntroductionOutcome,
} from '@/lib/introductions/outcomes';
import {
  captureIntroductionOutcomeAction,
  type IntroductionOutcomeActionClient,
} from '@/lib/introductions/outcome-actions';

const NOW = new Date('2026-07-08T12:00:00.000Z');

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

function createActionClient(options: {
  user?: { id: string } | null;
  identity?: { id: string; status: 'active' | 'pending' } | null;
  roles?: { role: 'member' | 'steward' | 'admin'; community_id: string | null }[];
  introduction?: null | {
    requester_identity_id: string;
    helper_identity_id: string;
    created_by_identity_id: string;
  };
  auditError?: Error | null;
  outcomeError?: Error | null;
}) {
  const auditEvents: unknown[] = [];
  const outcomeRows: unknown[] = [];
  const outcomeInsert = vi.fn((payload: unknown) => {
    outcomeRows.push(payload);
    const row = {
      id: 'outcome-1',
      ...(payload as Record<string, unknown>),
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    };
    const builder = {
      select: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: row, error: options.outcomeError ?? null })),
    };
    return builder;
  });
  const auditInsert = vi.fn(async (payload: unknown) => {
    auditEvents.push(payload);
    return { error: options.auditError ?? null };
  });
  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: options.user ?? null }, error: null })),
    },
    from: vi.fn(
      (
        table:
          | 'trusted_identities'
          | 'user_roles'
          | 'introductions'
          | 'introduction_outcomes'
          | 'audit_events',
      ) => {
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
            eq: vi.fn(async () => ({ data: options.roles ?? [], error: null })),
          };
        }

        if (table === 'introductions') {
          const row =
            options.introduction === null
              ? null
              : {
                  id: 'intro-123',
                  request_id: 'request-123',
                  match_id: 'match-123',
                  steward_review_id: 'review-123',
                  requester_identity_id:
                    options.introduction?.requester_identity_id ?? 'identity-seeker',
                  helper_identity_id: options.introduction?.helper_identity_id ?? 'identity-helper',
                  created_by_identity_id:
                    options.introduction?.created_by_identity_id ?? 'identity-steward',
                  status: 'draft',
                  context: {},
                  created_at: NOW.toISOString(),
                  updated_at: NOW.toISOString(),
                };

          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn(async () => ({ data: row, error: null })),
          };
        }

        if (table === 'introduction_outcomes') return { insert: outcomeInsert };
        return { insert: auditInsert };
      },
    ),
  } as unknown as IntroductionOutcomeActionClient;

  return { client, auditEvents, outcomeRows, outcomeInsert };
}

describe('introduction outcome helpers', () => {
  it('defines the MVP outcome vocabulary and guard', () => {
    expect(INTRODUCTION_OUTCOME_VALUES).toEqual([
      'connected',
      'meeting_scheduled',
      'in_conversation',
      'opportunity_created',
      'not_a_fit',
      'no_response',
    ]);
    expect(isIntroductionOutcome('connected')).toBe(true);
    expect(isIntroductionOutcome('unknown')).toBe(false);
  });

  it('captures a normalized outcome and emits privacy-safe audit metadata', () => {
    const result = captureIntroductionOutcome({
      introductionId: ' intro-123 ',
      reporterIdentityId: ' identity-123 ',
      outcome: 'meeting_scheduled',
      note: '  We   are meeting next week.  ',
      occurredAt: NOW,
    });

    expect(result.outcome).toEqual({
      introductionId: 'intro-123',
      reporterIdentityId: 'identity-123',
      outcome: 'meeting_scheduled',
      note: 'We are meeting next week.',
      capturedAt: '2026-07-08T12:00:00.000Z',
    });
    expect(result.event).toEqual({
      event_type: 'introduction_outcome.meeting_scheduled',
      actor_identity_id: 'identity-123',
      subject_table: 'introductions',
      subject_id: 'intro-123',
      occurred_at: '2026-07-08T12:00:00.000Z',
      metadata: { outcome: 'meeting_scheduled', hasNote: true, noteLength: 25 },
    });
    expect(JSON.stringify(result.event)).not.toContain('meeting next week');
  });

  it('rejects missing ids and overlong notes', () => {
    expect(() =>
      captureIntroductionOutcome({
        introductionId: '',
        reporterIdentityId: 'identity-helper',
        outcome: 'connected',
      }),
    ).toThrow('Introduction id is required.');

    expect(() =>
      captureIntroductionOutcome({
        introductionId: 'intro-123',
        reporterIdentityId: 'identity-helper',
        outcome: 'connected',
        note: 'a'.repeat(501),
      }),
    ).toThrow('Outcome note must be 500 characters or fewer.');
  });
});

describe('captureIntroductionOutcomeAction', () => {
  it('requires a current trusted identity', async () => {
    const { client, auditEvents, outcomeRows } = createActionClient({ user: null, identity: null });

    await expect(
      captureIntroductionOutcomeAction('intro-123', formData({ outcome: 'connected' }), {
        supabase: client,
      }),
    ).resolves.toMatchObject({ ok: false, error: 'auth_required' });
    expect(auditEvents).toEqual([]);
    expect(outcomeRows).toEqual([]);
  });

  it('allows introduction participants to capture outcomes', async () => {
    const { client, auditEvents, outcomeRows } = createActionClient({
      user: { id: 'user-123' },
      identity: { id: 'identity-seeker', status: 'active' },
    });

    await expect(
      captureIntroductionOutcomeAction('intro-123', formData({ outcome: 'connected' }), {
        supabase: client,
        now: NOW,
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(outcomeRows).toHaveLength(1);
    expect(auditEvents).toHaveLength(1);
  });

  it('allows admins to capture outcomes even when they are not participants', async () => {
    const { client, auditEvents, outcomeRows } = createActionClient({
      user: { id: 'user-123' },
      identity: { id: 'identity-admin', status: 'active' },
      roles: [{ role: 'admin', community_id: null }],
    });

    await expect(
      captureIntroductionOutcomeAction('intro-123', formData({ outcome: 'connected' }), {
        supabase: client,
        now: NOW,
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(outcomeRows).toHaveLength(1);
    expect(auditEvents).toHaveLength(1);
  });

  it('blocks non-participants from capturing outcomes', async () => {
    const { client, auditEvents, outcomeRows } = createActionClient({
      user: { id: 'user-123' },
      identity: { id: 'identity-outsider', status: 'active' },
    });

    await expect(
      captureIntroductionOutcomeAction('intro-123', formData({ outcome: 'connected' }), {
        supabase: client,
      }),
    ).resolves.toMatchObject({ ok: false, error: 'forbidden' });
    expect(outcomeRows).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it('returns validation errors for unsupported outcomes before writing', async () => {
    const { client, auditEvents, outcomeRows } = createActionClient({
      user: { id: 'user-123' },
      identity: { id: 'identity-helper', status: 'active' },
    });

    await expect(
      captureIntroductionOutcomeAction('intro-123', formData({ outcome: 'invalid' }), {
        supabase: client,
      }),
    ).resolves.toEqual({
      ok: false,
      error: 'validation',
      message: 'Choose a valid introduction outcome.',
    });
    expect(outcomeRows).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it('writes the durable outcome before its audit event and returns the captured outcome', async () => {
    const { client, auditEvents, outcomeRows, outcomeInsert } = createActionClient({
      user: { id: 'user-123' },
      identity: { id: 'identity-helper', status: 'active' },
    });

    const result = await captureIntroductionOutcomeAction(
      'intro-123',
      formData({ outcome: 'opportunity_created', note: '  Hiring loop started. ' }),
      { supabase: client, now: NOW },
    );

    expect(result).toMatchObject({
      ok: true,
      outcome: {
        introductionId: 'intro-123',
        outcome: 'opportunity_created',
        reporterIdentityId: 'identity-helper',
        note: 'Hiring loop started.',
      },
    });
    expect(outcomeInsert).toHaveBeenCalledTimes(1);
    expect(outcomeRows).toEqual([
      {
        introduction_id: 'intro-123',
        reporter_identity_id: 'identity-helper',
        outcome: 'opportunity_created',
        private_note: 'Hiring loop started.',
        occurred_at: '2026-07-08T12:00:00.000Z',
      },
    ]);
    expect(auditEvents).toEqual([
      {
        event_type: 'introduction_outcome.opportunity_created',
        actor_identity_id: 'identity-helper',
        subject_table: 'introductions',
        subject_id: 'intro-123',
        occurred_at: '2026-07-08T12:00:00.000Z',
        metadata: { outcome: 'opportunity_created', hasNote: true, noteLength: 20 },
      },
    ]);
  });
});
