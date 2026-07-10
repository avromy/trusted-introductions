import { describe, expect, it } from 'vitest';

import {
  OUTCOME_PROMPT_NOTIFICATION_TYPE,
  orchestrateOutcomePromptNotifications,
} from '@/lib/notifications/outcome';

const NOW = new Date('2026-07-10T12:00:00.000Z');
const CREATED_AT = '2026-07-08T12:00:00.000Z';
const DAY_MS = 24 * 60 * 60 * 1000;

const introduction = {
  id: 'intro-123',
  requesterIdentityId: 'identity-requester',
  helperIdentityId: 'identity-helper',
  createdByIdentityId: 'identity-steward',
  status: 'ready' as const,
  createdAt: CREATED_AT,
};

const policy = {
  elapsedMs: DAY_MS,
  occurrenceKey: 'day-1',
  recipientRoles: ['requester', 'helper', 'steward'] as const,
};

describe('outcome prompt notification orchestration', () => {
  it('queues privacy-safe prompts for eligible introduction participants and stewards', () => {
    const result = orchestrateOutcomePromptNotifications({ introduction, policy, now: NOW });

    expect(result.skipped).toEqual([]);
    expect(result.queued).toHaveLength(3);
    expect(result.queued.map((prompt) => prompt.recipientIdentityId)).toEqual([
      'identity-requester',
      'identity-helper',
      'identity-steward',
    ]);
    expect(result.queued[0]).toMatchObject({
      type: OUTCOME_PROMPT_NOTIFICATION_TYPE,
      idempotencyKey:
        'introduction_outcome_prompt.request_status_update:intro-123:identity-requester:day-1',
      introductionId: 'intro-123',
      occurrenceKey: 'day-1',
      template: {
        subject: 'Quick status update requested',
        body: 'Please share a quick status update for this introduction when you have a moment.',
      },
      metadata: {
        introductionId: 'intro-123',
        occurrenceKey: 'day-1',
        recipientRole: 'requester',
        promptElapsedMs: DAY_MS,
      },
      queuedAt: NOW.toISOString(),
    });
  });

  it('does not queue prompts before the configured elapsed period or for ineligible introductions', () => {
    expect(
      orchestrateOutcomePromptNotifications({
        introduction: { ...introduction, createdAt: '2026-07-10T00:00:00.000Z' },
        policy,
        now: NOW,
      }),
    ).toEqual({ queued: [], skipped: [{ reason: 'not_elapsed' }] });

    expect(
      orchestrateOutcomePromptNotifications({
        introduction: { ...introduction, status: 'draft' },
        policy,
        now: NOW,
      }),
    ).toEqual({ queued: [], skipped: [{ reason: 'ineligible_introduction' }] });
  });

  it('skips prompts already queued for the same introduction, recipient, and occurrence', () => {
    const result = orchestrateOutcomePromptNotifications({
      introduction,
      policy: { ...policy, recipientRoles: ['requester', 'helper'] },
      now: NOW,
      queuedPrompts: [
        {
          introductionId: 'intro-123',
          recipientIdentityId: 'identity-requester',
          occurrenceKey: 'day-1',
        },
      ],
    });

    expect(result.queued).toHaveLength(1);
    expect(result.queued[0].recipientIdentityId).toBe('identity-helper');
    expect(result.skipped).toEqual([
      { recipientIdentityId: 'identity-requester', reason: 'already_queued' },
    ]);
  });

  it('does not enqueue when a terminal introduction outcome already exists', () => {
    expect(
      orchestrateOutcomePromptNotifications({
        introduction,
        policy,
        now: NOW,
        outcomes: [{ outcome: 'not_a_fit' }],
      }),
    ).toEqual({ queued: [], skipped: [{ reason: 'terminal_outcome' }] });
  });

  it('does not leak existing private outcome notes or confidential responses', () => {
    const result = orchestrateOutcomePromptNotifications({
      introduction,
      policy: { ...policy, recipientRoles: ['requester'] },
      now: NOW,
      outcomes: [{ outcome: 'meeting_scheduled' }],
    });

    const serialized = JSON.stringify(result);
    expect(result.queued).toHaveLength(1);
    expect(serialized).not.toContain('meeting next week');
    expect(serialized).not.toContain('confidential');
    expect(result.queued[0].template.body).toBe(
      'Please share a quick status update for this introduction when you have a moment.',
    );
  });

  it('skips unauthorized recipients supplied by an orchestration caller', () => {
    const result = orchestrateOutcomePromptNotifications({
      introduction,
      policy,
      now: NOW,
      recipients: [{ identityId: 'identity-outsider', role: 'helper' }],
    });

    expect(result).toEqual({
      queued: [],
      skipped: [{ recipientIdentityId: 'identity-outsider', reason: 'unauthorized_recipient' }],
    });
  });
});
