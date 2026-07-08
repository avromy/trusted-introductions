import { describe, expect, it } from 'vitest';

import {
  STEWARD_REVIEW_STATUSES,
  approveStewardReview,
  isFinalStewardReviewStatus,
  isStewardReviewStatus,
  rejectStewardReview,
  requestStewardReviewInfo,
  type StewardReview,
} from '@/lib/matching/steward-review';

const BASE_REVIEW: StewardReview = {
  id: 'review-123',
  requestId: 'match-request-456',
  stewardIdentityId: 'steward-789',
  subjectIdentityId: 'candidate-321',
  status: 'pending',
  decidedAt: null,
  decisionReason: null,
};

const DECIDED_AT = new Date('2026-07-08T12:00:00.000Z');

describe('steward review helpers', () => {
  it('defines review statuses and status guards', () => {
    expect(STEWARD_REVIEW_STATUSES).toEqual(['pending', 'approved', 'rejected', 'needs_info']);
    expect(isStewardReviewStatus('approved')).toBe(true);
    expect(isStewardReviewStatus('unknown')).toBe(false);
    expect(isFinalStewardReviewStatus('approved')).toBe(true);
    expect(isFinalStewardReviewStatus('rejected')).toBe(true);
    expect(isFinalStewardReviewStatus('needs_info')).toBe(false);
  });

  it('approves a pending steward review and emits a safe event payload', () => {
    const result = approveStewardReview({
      review: BASE_REVIEW,
      stewardIdentityId: 'steward-789',
      reason: ' Looks good to proceed. ',
      decidedAt: DECIDED_AT,
    });

    expect(result.review).toEqual({
      ...BASE_REVIEW,
      status: 'approved',
      decidedAt: '2026-07-08T12:00:00.000Z',
      decisionReason: 'Looks good to proceed.',
    });
    expect(result.event).toEqual({
      event_type: 'steward_review.approved',
      actor_identity_id: 'steward-789',
      subject_table: 'steward_reviews',
      subject_id: 'review-123',
      occurred_at: '2026-07-08T12:00:00.000Z',
      metadata: {
        requestId: 'match-request-456',
        subjectIdentityId: 'candidate-321',
        previousStatus: 'pending',
        status: 'approved',
        hasReason: true,
        reasonLength: 22,
      },
    });
    expect(JSON.stringify(result.event)).not.toContain('Looks good to proceed.');
  });

  it('rejects a review without leaking reason text into event metadata', () => {
    const result = rejectStewardReview({
      review: BASE_REVIEW,
      stewardIdentityId: 'steward-789',
      reason: 'Private rejection details',
      decidedAt: '2026-07-08T13:00:00.000Z',
    });

    expect(result.review.status).toBe('rejected');
    expect(result.review.decisionReason).toBe('Private rejection details');
    expect(result.event.event_type).toBe('steward_review.rejected');
    expect(result.event.metadata).toMatchObject({
      previousStatus: 'pending',
      status: 'rejected',
      hasReason: true,
      reasonLength: 25,
    });
    expect(JSON.stringify(result.event)).not.toContain('Private rejection details');
  });

  it('marks a review as needing more information', () => {
    const result = requestStewardReviewInfo({
      review: BASE_REVIEW,
      stewardIdentityId: 'steward-789',
      reason: '   ',
      decidedAt: DECIDED_AT,
    });

    expect(result.review.status).toBe('needs_info');
    expect(result.review.decisionReason).toBeNull();
    expect(result.event).toMatchObject({
      event_type: 'steward_review.needs_info',
      metadata: { status: 'needs_info', hasReason: false, reasonLength: 0 },
    });
  });

  it('allows a needs-info review to receive a final decision', () => {
    const result = approveStewardReview({
      review: { ...BASE_REVIEW, status: 'needs_info' },
      stewardIdentityId: 'steward-789',
      decidedAt: DECIDED_AT,
    });

    expect(result.review.status).toBe('approved');
    expect(result.event.metadata.previousStatus).toBe('needs_info');
  });

  it('rejects decisions from unassigned stewards or final statuses', () => {
    expect(() =>
      approveStewardReview({
        review: BASE_REVIEW,
        stewardIdentityId: 'steward-other',
        decidedAt: DECIDED_AT,
      }),
    ).toThrow('Only the assigned steward can decide this review.');

    expect(() =>
      rejectStewardReview({
        review: { ...BASE_REVIEW, status: 'approved' },
        stewardIdentityId: 'steward-789',
        decidedAt: DECIDED_AT,
      }),
    ).toThrow('Steward review with status "approved" cannot be changed.');
  });
});
