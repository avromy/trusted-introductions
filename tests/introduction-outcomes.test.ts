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
  auditError?: Error | null;
}) {
  const auditEvents: unknown[] = [];
  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: options.user ?? null }, error: null })),
    },
    from: vi.fn((table: 'trusted_identities' | 'user_roles' | 'audit_events') => {
      if (table === 'trusted_identities') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({
            data: options.identity
              ? { id: options.identity.id, status: options.identity.status, user_id: options.user?.id ?? null }
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

      return {
        insert: vi.fn(async (payload: unknown) => {
          auditEvents.push(payload);
          return { error: options.auditError ?? null };
        }),
      };
    }),
  } as unknown as IntroductionOutcomeActionClient;

  return { client, auditEvents };
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
        reporterIdentityId: 'identity-123',
        outcome: 'connected',
      }),
    ).toThrow('Introduction id is required.');

    expect(() =>
      captureIntroductionOutcome({
        introductionId: 'intro-123',
        reporterIdentityId: 'identity-123',
        outcome: 'connected',
        note: 'a'.repeat(501),
      }),
    ).toThrow('Outcome note must be 500 characters or fewer.');
  });
});

describe('captureIntroductionOutcomeAction', () => {
  it('requires a current trusted identity', async () => {
    const { client, auditEvents } = createActionClient({ user: null, identity: null });

    await expect(
      captureIntroductionOutcomeAction('intro-123', formData({ outcome: 'connected' }), {
        supabase: client,
      }),
    ).resolves.toMatchObject({ ok: false, error: 'auth_required' });
    expect(auditEvents).toEqual([]);
  });

  it('returns validation errors for unsupported outcomes before writing audit', async () => {
    const { client, auditEvents } = createActionClient({
      user: { id: 'user-123' },
      identity: { id: 'identity-123', status: 'active' },
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
    expect(auditEvents).toEqual([]);
  });

  it('writes an audit event and returns the captured outcome', async () => {
    const { client, auditEvents } = createActionClient({
      user: { id: 'user-123' },
      identity: { id: 'identity-123', status: 'active' },
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
        reporterIdentityId: 'identity-123',
        note: 'Hiring loop started.',
      },
    });
    expect(auditEvents).toEqual([
      {
        event_type: 'introduction_outcome.opportunity_created',
        actor_identity_id: 'identity-123',
        subject_table: 'introductions',
        subject_id: 'intro-123',
        occurred_at: '2026-07-08T12:00:00.000Z',
        metadata: { outcome: 'opportunity_created', hasNote: true, noteLength: 20 },
      },
    ]);
  });
});
