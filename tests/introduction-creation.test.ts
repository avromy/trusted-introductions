import { describe, expect, it } from 'vitest';

import {
  createIntroductionFromApprovedMatch,
  normalizeIntroductionMessage,
} from '@/lib/introductions/creation';
import {
  insertIntroduction,
  mapIntroductionRow,
  type IntroductionRow,
} from '@/lib/introductions/repository';

const NOW = new Date('2026-07-08T12:00:00.000Z');

function row(overrides: Partial<IntroductionRow> = {}): IntroductionRow {
  return {
    id: 'intro-1',
    request_id: 'request-1',
    match_suggestion_id: 'suggestion-1',
    requester_identity_id: 'requester-1',
    helper_identity_id: 'helper-1',
    steward_identity_id: 'steward-1',
    steward_review_id: 'review-1',
    status: 'drafted',
    message: 'Warm intro draft.',
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

describe('introduction creation workflow', () => {
  it('normalizes optional steward draft copy', () => {
    expect(normalizeIntroductionMessage('  Hello   there.  ')).toBe('Hello there.');
    expect(normalizeIntroductionMessage('   ')).toBeNull();
    expect(() => normalizeIntroductionMessage('a'.repeat(2001))).toThrow(
      'Introduction message must be 2000 characters or fewer.',
    );
  });

  it('creates a drafted introduction only from an approved steward review', () => {
    const result = createIntroductionFromApprovedMatch({
      requestId: ' request-1 ',
      matchSuggestionId: ' suggestion-1 ',
      requesterIdentityId: ' requester-1 ',
      helperIdentityId: ' helper-1 ',
      stewardIdentityId: ' steward-1 ',
      stewardReviewId: ' review-1 ',
      stewardReviewStatus: 'approved',
      message: '  I think you two should compare climate roles. ',
      createdAt: NOW,
    });

    expect(result.introduction).toEqual({
      requestId: 'request-1',
      matchSuggestionId: 'suggestion-1',
      requesterIdentityId: 'requester-1',
      helperIdentityId: 'helper-1',
      stewardIdentityId: 'steward-1',
      stewardReviewId: 'review-1',
      status: 'drafted',
      message: 'I think you two should compare climate roles.',
      createdAt: NOW.toISOString(),
    });
    expect(result.event).toEqual({
      event_type: 'introduction.created',
      actor_identity_id: 'steward-1',
      subject_table: 'introductions',
      subject_id: null,
      occurred_at: NOW.toISOString(),
      metadata: {
        requestId: 'request-1',
        matchSuggestionId: 'suggestion-1',
        requesterIdentityId: 'requester-1',
        helperIdentityId: 'helper-1',
        stewardReviewId: 'review-1',
        status: 'drafted',
        hasMessage: true,
        messageLength: 45,
      },
    });
    expect(JSON.stringify(result.event)).not.toContain('climate roles');
  });

  it('rejects unapproved reviews and self introductions', () => {
    expect(() =>
      createIntroductionFromApprovedMatch({
        requestId: 'request-1',
        matchSuggestionId: 'suggestion-1',
        requesterIdentityId: 'requester-1',
        helperIdentityId: 'helper-1',
        stewardIdentityId: 'steward-1',
        stewardReviewId: 'review-1',
        stewardReviewStatus: 'pending',
      }),
    ).toThrow('Introduction can only be created from an approved steward review.');

    expect(() =>
      createIntroductionFromApprovedMatch({
        requestId: 'request-1',
        matchSuggestionId: 'suggestion-1',
        requesterIdentityId: 'same-1',
        helperIdentityId: 'same-1',
        stewardIdentityId: 'steward-1',
        stewardReviewId: 'review-1',
        stewardReviewStatus: 'approved',
      }),
    ).toThrow('Helper and requester must be different identities.');
  });
});

describe('introduction repository', () => {
  it('maps introduction rows into the domain shape', () => {
    expect(mapIntroductionRow(row())).toEqual({
      id: 'intro-1',
      requestId: 'request-1',
      matchSuggestionId: 'suggestion-1',
      requesterIdentityId: 'requester-1',
      helperIdentityId: 'helper-1',
      stewardIdentityId: 'steward-1',
      stewardReviewId: 'review-1',
      status: 'drafted',
      message: 'Warm intro draft.',
      createdAt: NOW.toISOString(),
    });
  });

  it('inserts drafted introductions using database column names', async () => {
    const inserts: unknown[] = [];
    const client = {
      from: () => ({
        insert(payload: unknown) {
          inserts.push(payload);
          return this;
        },
        select() {
          return this;
        },
        single: async () => ({ data: row(), error: null }),
      }),
    };

    await expect(
      insertIntroduction(
        {
          requestId: 'request-1',
          matchSuggestionId: 'suggestion-1',
          requesterIdentityId: 'requester-1',
          helperIdentityId: 'helper-1',
          stewardIdentityId: 'steward-1',
          stewardReviewId: 'review-1',
          status: 'drafted',
          message: 'Warm intro draft.',
          createdAt: NOW.toISOString(),
        },
        client,
      ),
    ).resolves.toMatchObject({ id: 'intro-1' });
    expect(inserts).toEqual([
      {
        request_id: 'request-1',
        match_suggestion_id: 'suggestion-1',
        requester_identity_id: 'requester-1',
        helper_identity_id: 'helper-1',
        steward_identity_id: 'steward-1',
        steward_review_id: 'review-1',
        status: 'drafted',
        message: 'Warm intro draft.',
      },
    ]);
  });
});
