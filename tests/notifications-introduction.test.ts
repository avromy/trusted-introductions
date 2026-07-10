import { describe, expect, it, vi } from 'vitest';

import {
  buildIntroductionCoordinationNotifications,
  enqueueIntroductionCoordinationNotifications,
  INTRODUCTION_COORDINATION_NOTIFICATION_EVENT,
  type IntroductionCoordinationNotificationOutboxClient,
} from '@/lib/notifications/introduction/coordination';
import type { Introduction } from '@/lib/introductions/repository';

const NOW = new Date('2026-07-09T12:00:00.000Z');

function introduction(overrides: Partial<Introduction> = {}): Introduction {
  return {
    id: 'intro-1',
    requestId: 'request-1',
    matchId: 'match-1',
    stewardReviewId: 'review-1',
    requesterIdentityId: 'requester-1',
    helperIdentityId: 'helper-1',
    createdByIdentityId: 'steward-1',
    status: 'draft',
    context: {},
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function createOutboxClient(existingRoles: string[] = []) {
  const inserts: unknown[] = [];
  let role = '';
  const client = {
    from: vi.fn((table: 'audit_events') => {
      if (table !== 'audit_events') throw new Error(`Unexpected table ${table}`);
      const builder = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn(async (payload) => {
          inserts.push(payload);
          return { error: null };
        }),
        eq: vi.fn((column: string, value: unknown) => {
          if (column === 'metadata->>recipientRole') role = String(value);
          return builder;
        }),
        maybeSingle: vi.fn(async () => ({
          data: existingRoles.includes(role) ? { id: `existing-${role}` } : null,
          error: null,
        })),
      };
      return builder;
    }),
  } as unknown as IntroductionCoordinationNotificationOutboxClient;

  return { client, inserts };
}

describe('introduction coordination notifications', () => {
  it('builds a requester notification with neutral coordination copy', () => {
    const [requester] = buildIntroductionCoordinationNotifications({
      introduction: introduction(),
      requestHeadline: ' Seeking product role ',
    });

    expect(requester).toMatchObject({
      recipientIdentityId: 'requester-1',
      recipientRole: 'requester',
      templateKey: 'introduction_coordination_requester',
      subject: 'Introduction coordination started',
    });
    expect(requester.body).toContain('approved helper match is ready for coordination');
    expect(requester.body).not.toMatch(/endorse|AI/i);
  });

  it('builds a helper notification with a separate recipient message', () => {
    const [, helper] = buildIntroductionCoordinationNotifications({
      introduction: introduction(),
      requestHeadline: 'Seeking product role',
    });

    expect(helper).toMatchObject({
      recipientIdentityId: 'helper-1',
      recipientRole: 'helper',
      templateKey: 'introduction_coordination_helper',
      subject: 'Introduction coordination requested',
    });
    expect(helper.body).toContain('steward-approved introduction is ready for coordination');
  });

  it('suppresses duplicate requester and helper outbox messages', async () => {
    const { client, inserts } = createOutboxClient(['requester', 'helper']);

    await expect(
      enqueueIntroductionCoordinationNotifications(
        { introduction: introduction(), requestHeadline: 'Seeking product role', createdAt: NOW },
        client,
      ),
    ).resolves.toEqual([]);
    expect(inserts).toHaveLength(0);
  });

  it('enqueues privacy-safe payloads only', async () => {
    const { client, inserts } = createOutboxClient();

    await enqueueIntroductionCoordinationNotifications(
      {
        introduction: introduction({
          context: {
            privateStewardNotes: 'Do not include',
            rawIntroductionMessage: 'Private raw message',
            resumeUrl: 'https://private.example/resume.pdf',
            hiddenContactEmail: 'hidden@example.com',
          },
        }),
        requestHeadline: '  Seeking   product role  ',
        createdAt: NOW,
      },
      client,
    );

    expect(inserts).toHaveLength(2);
    expect(inserts[0]).toMatchObject({
      event_type: INTRODUCTION_COORDINATION_NOTIFICATION_EVENT,
      subject_table: 'introductions',
      subject_id: 'intro-1',
      metadata: {
        recipientIdentityId: 'requester-1',
        recipientRole: 'requester',
        payload: {
          introductionId: 'intro-1',
          requestId: 'request-1',
          requestHeadline: 'Seeking product role',
          messageContentIncluded: false,
        },
      },
    });
    expect(JSON.stringify(inserts)).not.toContain('Do not include');
    expect(JSON.stringify(inserts)).not.toContain('Private raw message');
    expect(JSON.stringify(inserts)).not.toContain('resume.pdf');
    expect(JSON.stringify(inserts)).not.toContain('hidden@example.com');
  });
});
