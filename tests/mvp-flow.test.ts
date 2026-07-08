import { describe, expect, it } from 'vitest';

import {
  createHelperCapability,
  serializeHelperCapability,
} from '@/lib/matching/helper-capability';
import {
  normalizeJobSeekerRequestInput,
  serializeJobSeekerRequestForHelper,
} from '@/lib/matching/job-seeker';
import { rankHelperCandidates } from '@/lib/matching/engine';
import { approveStewardReview, type StewardReview } from '@/lib/matching/steward-review';
import {
  createInvitePayload,
  markInviteRedeemedPayload,
  validateInviteForRedemption,
} from '@/lib/invites';
import type { JobSeekerRequest } from '@/types/matching';
import type { Database } from '@/types/supabase';

type InvitationRow = Database['public']['Tables']['invitations']['Row'];

type Introduction = {
  id: string;
  matchId: string;
  requesterIdentityId: string;
  helperIdentityId: string;
  stewardIdentityId: string;
  status: 'draft' | 'created';
  createdAt: string;
};

type FollowUp = {
  id: string;
  introductionId: string;
  dueAt: string;
  status: 'scheduled' | 'completed';
};

type Outcome = {
  id: string;
  introductionId: string;
  status: 'connected' | 'declined' | 'unresponsive' | 'needs_follow_up';
  capturedAt: string;
};

const NOW = new Date('2026-07-08T12:00:00.000Z');
const TOKEN = 'mvp-flow-invite-token';

function createInvitationRow(
  payload: ReturnType<typeof createInvitePayload>['payload'],
): InvitationRow {
  return {
    id: 'invite-mvp-1',
    invitee_email: payload.invitee_email,
    inviter_identity_id: payload.inviter_identity_id,
    community_id: payload.community_id,
    token_hash: payload.token_hash,
    status: payload.status,
    redemption_status: payload.redemption_status,
    expires_at: payload.expires_at,
    redeemed_at: null,
    redeemed_by_identity_id: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
  };
}

function createIntroduction(
  input: Omit<Introduction, 'id' | 'status' | 'createdAt'>,
): Introduction {
  return {
    id: 'intro-mvp-1',
    status: 'created',
    createdAt: NOW.toISOString(),
    ...input,
  };
}

function createFollowUp(introductionId: string): FollowUp {
  return {
    id: 'follow-up-mvp-1',
    introductionId,
    dueAt: '2026-07-15T12:00:00.000Z',
    status: 'scheduled',
  };
}

function captureOutcome(introductionId: string): Outcome {
  return {
    id: 'outcome-mvp-1',
    introductionId,
    status: 'connected',
    capturedAt: '2026-07-16T12:00:00.000Z',
  };
}

describe('MVP flow reconciliation', () => {
  it('covers invite, onboarding, matching, steward approval, introduction, follow-up, and outcome capture', () => {
    const invitePayload = createInvitePayload({
      inviteeEmail: 'seeker@example.com',
      inviterIdentityId: 'identity-steward',
      communityId: 'community-mvp',
      token: TOKEN,
      now: NOW,
    });
    const invitation = createInvitationRow(invitePayload.payload);

    expect(validateInviteForRedemption({ invite: invitation, token: TOKEN, now: NOW })).toEqual({
      valid: true,
      invite: {
        id: 'invite-mvp-1',
        inviteeEmail: 'seeker@example.com',
        communityId: 'community-mvp',
        expiresAt: '2026-07-15T12:00:00.000Z',
      },
    });

    const redeemed = markInviteRedeemedPayload({
      redeemedByIdentityId: 'identity-seeker',
      redeemedAt: NOW,
    });
    const onboarded = {
      identityId: redeemed.redeemed_by_identity_id,
      inviteStatus: redeemed.status,
      profileComplete: true,
      privacySettingsComplete: true,
      roleOrContributionModeComplete: true,
    };

    expect(onboarded).toMatchObject({
      identityId: 'identity-seeker',
      inviteStatus: 'accepted',
      profileComplete: true,
      privacySettingsComplete: true,
      roleOrContributionModeComplete: true,
    });

    const seekerRequestInput = normalizeJobSeekerRequestInput({
      identityId: onboarded.identityId,
      headline: ' Product leader seeking warm introductions ',
      targetRole: 'VP Product',
      targetCompanies: ['Acme Health', 'Northstar Labs'],
      targetLocations: ['New York', 'Remote'],
      notes: 'Private context for stewards.',
      status: 'open',
    });
    const seekerRequest: JobSeekerRequest = {
      id: 'request-mvp-1',
      ...seekerRequestInput,
      targetCompanies: seekerRequestInput.targetCompanies ?? [],
      targetLocations: seekerRequestInput.targetLocations ?? [],
      status: seekerRequestInput.status ?? 'draft',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      openedAt: NOW.toISOString(),
      closedAt: null,
    };

    expect(seekerRequest).toMatchObject({
      id: 'request-mvp-1',
      identityId: 'identity-seeker',
      status: 'open',
      headline: 'Product leader seeking warm introductions',
    });

    const helperCapability = createHelperCapability({
      categories: ['network_introduction', 'career_navigation'],
      availability: { status: 'available', weeklyIntroCapacity: 2 },
      industries: ['healthcare', 'enterprise software'],
      geographies: ['New York', 'Remote'],
      privateNotes: 'Knows Acme Health leadership.',
    });
    const safeHelperCapability = serializeHelperCapability(helperCapability);

    expect(safeHelperCapability).toEqual(
      expect.objectContaining({
        categories: ['network_introduction', 'career_navigation'],
        availability: { status: 'available', weeklyIntroCapacity: 2, nextAvailableAt: null },
      }),
    );
    expect(JSON.stringify(safeHelperCapability)).not.toContain('Acme Health leadership');

    const [match] = rankHelperCandidates(
      {
        id: seekerRequest.id,
        desiredHelp: ['network_introduction', 'career_navigation'],
        targetCompanies: seekerRequest.targetCompanies,
        targetIndustries: ['healthcare'],
        communities: ['community-mvp'],
      },
      [
        {
          id: 'identity-helper',
          displayName: 'Helpful Member',
          helpTypes: safeHelperCapability.categories,
          companies: ['Acme Health'],
          industries: safeHelperCapability.industries ?? undefined,
          communities: ['community-mvp'],
          availability: safeHelperCapability.availability.status,
          relationshipStrength: 3,
          allowMatching: true,
        },
      ],
    );

    expect(match).toEqual(
      expect.objectContaining({
        id: 'identity-helper',
        matchScore: expect.any(Number),
      }),
    );
    expect(match.matchScore).toBeGreaterThan(70);
    expect(match.matchExplanation.reasons).toContain(
      'Matches help type: career_navigation, network_introduction.',
    );

    const review: StewardReview = {
      id: 'review-mvp-1',
      requestId: seekerRequest.id,
      stewardIdentityId: 'identity-steward',
      subjectIdentityId: match.id,
      status: 'pending',
      decidedAt: null,
      decisionReason: null,
    };
    const approval = approveStewardReview({
      review,
      stewardIdentityId: 'identity-steward',
      reason: 'Strong trusted-access fit for the seeker request.',
      decidedAt: NOW,
    });

    expect(approval.review.status).toBe('approved');
    expect(approval.event.event_type).toBe('steward_review.approved');

    const introduction = createIntroduction({
      matchId: approval.review.id,
      requesterIdentityId: serializeJobSeekerRequestForHelper(seekerRequest).identityId,
      helperIdentityId: approval.review.subjectIdentityId,
      stewardIdentityId: approval.review.stewardIdentityId,
    });
    const followUp = createFollowUp(introduction.id);
    const outcome = captureOutcome(introduction.id);

    expect(introduction).toMatchObject({
      matchId: 'review-mvp-1',
      requesterIdentityId: 'identity-seeker',
      helperIdentityId: 'identity-helper',
      status: 'created',
    });
    expect(followUp).toMatchObject({ introductionId: introduction.id, status: 'scheduled' });
    expect(outcome).toMatchObject({ introductionId: introduction.id, status: 'connected' });
  });
});
