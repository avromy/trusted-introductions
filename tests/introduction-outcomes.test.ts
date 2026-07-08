import { describe, expect, it } from 'vitest';

import {
  canRecordIntroductionOutcome,
  createFollowUpReminderPayload,
  isIntroductionOutcomeStatus,
  normalizeOutcomeNotes,
  planIntroductionOutcome,
  type IntroductionForOutcome,
} from '@/lib/introductions/outcomes';

const introduction: IntroductionForOutcome = {
  id: 'intro-123',
  requester_identity_id: 'requester-1',
  helper_identity_id: 'helper-1',
  steward_identity_id: 'steward-1',
  status: 'active',
  community_id: 'community-1',
};

describe('introduction outcomes', () => {
  it('validates supported MVP outcome statuses', () => {
    expect(isIntroductionOutcomeStatus('completed')).toBe(true);
    expect(isIntroductionOutcomeStatus('declined')).toBe(true);
    expect(isIntroductionOutcomeStatus('unresponsive')).toBe(true);
    expect(isIntroductionOutcomeStatus('follow_up_needed')).toBe(true);
    expect(isIntroductionOutcomeStatus('introduced')).toBe(false);
  });

  it('authorizes requester, helper, steward, or steward/admin role only', () => {
    expect(canRecordIntroductionOutcome(introduction, 'requester-1')).toBe(true);
    expect(canRecordIntroductionOutcome(introduction, 'helper-1')).toBe(true);
    expect(canRecordIntroductionOutcome(introduction, 'steward-1')).toBe(true);
    expect(canRecordIntroductionOutcome(introduction, 'community-steward', true)).toBe(true);
    expect(canRecordIntroductionOutcome(introduction, 'stranger')).toBe(false);
  });

  it('normalizes notes and suppresses them for unresponsive outcomes', () => {
    expect(normalizeOutcomeNotes('  Helpful\ncontext\t ', 'completed')).toBe('Helpful context');
    expect(normalizeOutcomeNotes('Sensitive details', 'unresponsive')).toBeNull();
  });

  it('plans persisted outcome, status update, and safe audit metadata without exposing notes', () => {
    const plan = planIntroductionOutcome({
      introduction,
      actorIdentityId: 'helper-1',
      outcomeStatus: 'completed',
      notes: 'Candidate spoke with the hiring manager.',
      occurredAt: '2026-07-08T00:00:00.000Z',
    });

    expect(plan.outcome).toEqual({
      introduction_id: 'intro-123',
      outcome_status: 'completed',
      recorded_by_identity_id: 'helper-1',
      notes: 'Candidate spoke with the hiring manager.',
      created_at: '2026-07-08T00:00:00.000Z',
    });
    expect(plan.introductionUpdate).toMatchObject({
      status: 'completed',
      outcome_status: 'completed',
    });
    expect(plan.auditEvent).toMatchObject({
      event_type: 'introduction_outcome.recorded',
      actor_identity_id: 'helper-1',
      subject_table: 'introductions',
      subject_id: 'intro-123',
      metadata: expect.objectContaining({
        previousStatus: 'active',
        outcomeStatus: 'completed',
        hasNotes: true,
        notesLength: 40,
      }),
    });
    expect(plan.safeOutcome).toEqual({
      introductionId: 'intro-123',
      outcomeStatus: 'completed',
      recordedByIdentityId: 'helper-1',
      hasNotes: true,
      notesLength: 40,
      followUpReminder: false,
    });
    expect(JSON.stringify(plan.auditEvent)).not.toContain('hiring manager');
    expect(JSON.stringify(plan.safeOutcome)).not.toContain('hiring manager');
  });

  it('connects follow-up-needed outcomes to the follow-up reminder helper', () => {
    const helperPayload = createFollowUpReminderPayload({
      introduction,
      actorIdentityId: 'requester-1',
      followUpAt: '2026-07-15T00:00:00.000Z',
    });
    const plan = planIntroductionOutcome({
      introduction,
      actorIdentityId: 'requester-1',
      outcomeStatus: 'follow_up_needed',
      followUpAt: '2026-07-15T00:00:00.000Z',
      occurredAt: '2026-07-08T00:00:00.000Z',
    });

    expect(plan.introductionUpdate.status).toBe('follow_up_needed');
    expect(plan.followUpReminder).toEqual(helperPayload);
    expect(plan.safeOutcome.followUpReminder).toBe(true);
    expect(plan.auditEvent.metadata.followUpReminder).toBe(true);
  });
});
