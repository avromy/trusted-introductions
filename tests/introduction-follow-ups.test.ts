import { describe, expect, it, vi } from 'vitest';

import {
  completeIntroductionFollowUp,
  createIntroductionFollowUp,
  getDefaultFollowUpDueAt,
  getDueIntroductionFollowUps,
  isFollowUpDue,
  markIntroductionFollowUpReminderSent,
  normalizeIntroductionFollowUpInput,
  validateIntroductionFollowUpInput,
} from '@/lib/introductions/follow-ups';
import {
  markIntroductionFollowUpReminderSentAction,
  scheduleIntroductionFollowUpAction,
  type IntroductionFollowUpActionClient,
} from '@/lib/introductions/follow-up-actions';

const NOW = new Date('2026-07-08T12:00:00.000Z');

const followUpInput = {
  introductionId: ' introduction-123 ',
  requesterIdentityId: ' identity-seeker ',
  helperIdentityId: ' identity-helper ',
  stewardIdentityId: ' identity-steward ',
  notes: '  Check whether the intro connected.  ',
};

function mockActionClient() {
  const auditEvents: unknown[] = [];
  const client = {
    from: vi.fn((table: 'audit_events') => {
      expect(table).toBe('audit_events');

      return {
        insert: async (payload: unknown) => {
          auditEvents.push(payload);

          return { error: null };
        },
      };
    }),
  } as unknown as IntroductionFollowUpActionClient;

  return { client, auditEvents };
}

describe('introduction follow-up reminders', () => {
  it('defaults a new follow-up to one week after the introduction handoff', () => {
    expect(getDefaultFollowUpDueAt(NOW).toISOString()).toBe('2026-07-15T12:00:00.000Z');

    const followUp = createIntroductionFollowUp(followUpInput, {
      id: 'follow-up-123',
      now: NOW,
    });

    expect(followUp).toEqual({
      id: 'follow-up-123',
      introductionId: 'introduction-123',
      requesterIdentityId: 'identity-seeker',
      helperIdentityId: 'identity-helper',
      stewardIdentityId: 'identity-steward',
      dueAt: '2026-07-15T12:00:00.000Z',
      status: 'scheduled',
      createdAt: '2026-07-08T12:00:00.000Z',
      updatedAt: '2026-07-08T12:00:00.000Z',
      completedAt: null,
      reminderSentAt: null,
      notes: 'Check whether the intro connected.',
    });
  });

  it('normalizes custom scheduling input without exposing private notes changes', () => {
    expect(
      normalizeIntroductionFollowUpInput(
        {
          ...followUpInput,
          dueAt: '2026-07-10T09:30:00.000Z',
          createdAt: '2026-07-08T09:30:00.000Z',
          status: 'sent',
          notes: '   ',
        },
        NOW,
      ),
    ).toEqual({
      introductionId: 'introduction-123',
      requesterIdentityId: 'identity-seeker',
      helperIdentityId: 'identity-helper',
      stewardIdentityId: 'identity-steward',
      dueAt: '2026-07-10T09:30:00.000Z',
      status: 'sent',
      createdAt: '2026-07-08T09:30:00.000Z',
      notes: null,
    });
  });

  it('validates required participants, statuses, dates, and note length', () => {
    const result = validateIntroductionFollowUpInput({
      introductionId: ' ',
      requesterIdentityId: '',
      helperIdentityId: 'identity-helper',
      stewardIdentityId: 'identity-steward',
      dueAt: 'not-a-date',
      status: 'overdue' as never,
      notes: 'x'.repeat(2_001),
    });

    expect(result).toEqual({
      valid: false,
      errors: {
        introductionId: ['Required.'],
        requesterIdentityId: ['Required.'],
        dueAt: ['Must be a valid date.'],
        notes: ['Must be 2000 characters or fewer.'],
        status: ['Status is not supported.'],
      },
    });
  });

  it('finds due scheduled reminders only', () => {
    const due = createIntroductionFollowUp(
      { ...followUpInput, dueAt: '2026-07-08T11:59:00.000Z' },
      { id: 'due', now: NOW },
    );
    const later = createIntroductionFollowUp(
      { ...followUpInput, dueAt: '2026-07-08T12:01:00.000Z' },
      { id: 'later', now: NOW },
    );
    const sent = markIntroductionFollowUpReminderSent(due, NOW);

    expect(isFollowUpDue(due, NOW)).toBe(true);
    expect(isFollowUpDue(later, NOW)).toBe(false);
    expect(isFollowUpDue(sent, NOW)).toBe(false);
    expect(
      getDueIntroductionFollowUps([due, later, sent], NOW).map((followUp) => followUp.id),
    ).toEqual(['due']);
  });

  it('marks reminders sent and completed with immutable timestamps', () => {
    const followUp = createIntroductionFollowUp(followUpInput, { id: 'follow-up-123', now: NOW });
    const sent = markIntroductionFollowUpReminderSent(followUp, '2026-07-15T12:05:00.000Z');
    const completed = completeIntroductionFollowUp(sent, '2026-07-16T10:00:00.000Z');

    expect(sent).toMatchObject({
      id: 'follow-up-123',
      status: 'sent',
      reminderSentAt: '2026-07-15T12:05:00.000Z',
      updatedAt: '2026-07-15T12:05:00.000Z',
    });
    expect(completed).toMatchObject({
      status: 'completed',
      completedAt: '2026-07-16T10:00:00.000Z',
      reminderSentAt: '2026-07-15T12:05:00.000Z',
    });
  });

  it('schedules follow-ups through the server helper and writes a safe audit event', async () => {
    const { client, auditEvents } = mockActionClient();

    const result = await scheduleIntroductionFollowUpAction(followUpInput, {
      supabase: client,
      id: 'follow-up-123',
      now: NOW,
    });

    expect(result).toMatchObject({
      ok: true,
      followUp: { id: 'follow-up-123', status: 'scheduled' },
    });
    expect(auditEvents).toEqual([
      {
        event_type: 'introduction_follow_up.scheduled',
        actor_type: 'user',
        actor_id: 'identity-steward',
        target_type: 'introduction_follow_up',
        target_id: 'follow-up-123',
        metadata: {
          introductionId: 'introduction-123',
          requesterIdentityId: 'identity-seeker',
          helperIdentityId: 'identity-helper',
          dueAt: '2026-07-15T12:00:00.000Z',
        },
        occurred_at: '2026-07-08T12:00:00.000Z',
      },
    ]);
    expect(JSON.stringify(auditEvents)).not.toContain('Check whether the intro connected.');
  });

  it('returns validation failures from the server helper without auditing', async () => {
    const { client, auditEvents } = mockActionClient();

    const result = await scheduleIntroductionFollowUpAction(
      { ...followUpInput, introductionId: '', status: 'overdue' as never },
      { supabase: client, now: NOW },
    );

    expect(result).toEqual({
      ok: false,
      error: 'validation',
      errors: {
        introductionId: ['Required.'],
        status: ['Status is not supported.'],
      },
    });
    expect(auditEvents).toHaveLength(0);
  });

  it('audits reminder delivery through the server helper', async () => {
    const { client, auditEvents } = mockActionClient();
    const followUp = createIntroductionFollowUp(followUpInput, { id: 'follow-up-123', now: NOW });

    const result = await markIntroductionFollowUpReminderSentAction(followUp, {
      supabase: client,
      sentAt: new Date('2026-07-15T12:05:00.000Z'),
    });

    expect(result.followUp).toMatchObject({
      id: 'follow-up-123',
      status: 'sent',
      reminderSentAt: '2026-07-15T12:05:00.000Z',
    });
    expect(auditEvents).toEqual([
      expect.objectContaining({
        event_type: 'introduction_follow_up.reminder_sent',
        target_id: 'follow-up-123',
        occurred_at: '2026-07-15T12:05:00.000Z',
      }),
    ]);
  });
});
