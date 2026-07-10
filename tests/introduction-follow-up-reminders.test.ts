import { describe, expect, it, vi } from 'vitest';

import {
  scheduleIntroductionFollowUpReminderAction,
  type IntroductionFollowUpReminderActionClient,
} from '@/lib/introductions/follow-up-reminder-actions';
import {
  normalizeFollowUpReminderRecipients,
  scheduleIntroductionFollowUpReminder,
} from '@/lib/introductions/follow-up-reminders';

const NOW = new Date('2026-07-08T12:00:00.000Z');

type TableName = 'trusted_identities' | 'user_roles' | 'audit_events';

function createFormData(overrides: Record<string, string | string[]> = {}): FormData {
  const formData = new FormData();
  const values: Record<string, string | string[]> = {
    remindAt: '2026-07-10T12:00:00.000Z',
    recipientIdentityIds: ['identity-seeker', 'identity-helper', 'identity-helper'],
    note: ' Check whether the intro connected. ',
    ...overrides,
  };

  Object.entries(values).forEach(([key, value]) => {
    const entries = Array.isArray(value) ? value : [value];
    entries.forEach((entry) => formData.append(key, entry));
  });

  return formData;
}

function createSupabaseMock(options: { insertError?: Error | null } = {}) {
  const insert = vi.fn(async () => ({ error: options.insertError ?? null }));
  const maybeSingleIdentity = vi.fn(async () => ({
    data: {
      id: 'identity-steward',
      user_id: 'user-1',
      community_id: 'community-1',
      status: 'active',
    },
    error: null,
  }));
  const maybeSingleRole = vi.fn(async () => ({
    data: { role: 'steward' },
    error: null,
  }));
  const supabase = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: vi.fn((table: TableName) => {
      if (table === 'trusted_identities') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: maybeSingleIdentity,
        };
      }

      if (table === 'user_roles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: maybeSingleRole,
        };
      }

      return { insert };
    }),
  };

  return { supabase: supabase as unknown as IntroductionFollowUpReminderActionClient, insert };
}

describe('introduction follow-up reminder helpers', () => {
  it('schedules a reminder audit event with normalized recipients and notes', () => {
    const result = scheduleIntroductionFollowUpReminder({
      introductionId: ' intro-123 ',
      stewardIdentityId: ' steward-123 ',
      remindAt: '2026-07-10T12:00:00.000Z',
      recipientIdentityIds: [' seeker-123 ', 'helper-123', 'helper-123', ' '],
      note: ' Follow up   after Shabbat. ',
      createdAt: NOW,
    });

    expect(result.reminder).toEqual({
      introductionId: 'intro-123',
      stewardIdentityId: 'steward-123',
      remindAt: '2026-07-10T12:00:00.000Z',
      recipientIdentityIds: ['seeker-123', 'helper-123'],
      note: 'Follow up after Shabbat.',
      status: 'scheduled',
      createdAt: NOW.toISOString(),
    });
    expect(result.event).toEqual({
      event_type: 'introduction_follow_up_reminder.scheduled',
      actor_identity_id: 'steward-123',
      subject_table: 'introductions',
      subject_id: 'intro-123',
      occurred_at: NOW.toISOString(),
      metadata: {
        remindAt: '2026-07-10T12:00:00.000Z',
        recipientIdentityIds: ['seeker-123', 'helper-123'],
        recipientCount: 2,
        hasNote: true,
        noteLength: 24,
        status: 'scheduled',
      },
    });
  });

  it('validates recipients, due dates, and note length before scheduling', () => {
    expect(() => normalizeFollowUpReminderRecipients([' ', ''])).toThrow(
      'At least one reminder recipient is required.',
    );
    expect(() =>
      scheduleIntroductionFollowUpReminder({
        introductionId: 'intro-123',
        stewardIdentityId: 'steward-123',
        remindAt: 'not-a-date',
        recipientIdentityIds: ['helper-123'],
        createdAt: NOW,
      }),
    ).toThrow('Reminder time must be a valid date.');

    expect(() =>
      scheduleIntroductionFollowUpReminder({
        introductionId: 'intro-123',
        stewardIdentityId: 'steward-123',
        remindAt: NOW,
        recipientIdentityIds: ['helper-123'],
        createdAt: NOW,
      }),
    ).toThrow('Reminder time must be in the future.');

    expect(() =>
      scheduleIntroductionFollowUpReminder({
        introductionId: 'intro-123',
        stewardIdentityId: 'steward-123',
        remindAt: '2026-07-10T12:00:00.000Z',
        recipientIdentityIds: ['helper-123'],
        note: 'a'.repeat(501),
        createdAt: NOW,
      }),
    ).toThrow('Reminder note must be 500 characters or fewer.');
  });
});

describe('scheduleIntroductionFollowUpReminderAction', () => {
  it('persists the scheduled reminder audit event', async () => {
    const { supabase, insert } = createSupabaseMock();

    const result = await scheduleIntroductionFollowUpReminderAction('intro-123', createFormData(), {
      supabase,
      now: NOW,
    });

    expect(result).toEqual({
      ok: true,
      reminder: expect.objectContaining({
        introductionId: 'intro-123',
        stewardIdentityId: 'identity-steward',
        recipientIdentityIds: ['identity-seeker', 'identity-helper'],
        status: 'scheduled',
      }),
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'introduction_follow_up_reminder.scheduled',
        actor_identity_id: 'identity-steward',
        subject_table: 'introductions',
        subject_id: 'intro-123',
      }),
    );
  });

  it('returns validation errors for invalid submitted reminders', async () => {
    const { supabase } = createSupabaseMock();

    const result = await scheduleIntroductionFollowUpReminderAction(
      'intro-123',
      createFormData({ remindAt: '2026-07-08T12:00:00.000Z' }),
      { supabase, now: NOW },
    );

    expect(result).toEqual({
      ok: false,
      error: 'validation',
      message: 'Reminder time must be in the future.',
    });
  });
});
