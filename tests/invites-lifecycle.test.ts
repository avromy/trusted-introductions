import { describe, expect, it, vi } from 'vitest';

import {
  createInvitePayload,
  hashInviteToken,
  markInviteRedeemedPayload,
  markInviteRevokedPayload,
  validateInviteForRedemption,
} from '@/lib/invites';
import * as inviteTokens from '@/lib/invites/tokens';
import type { Database } from '@/types/supabase';

type InvitationRow = Database['public']['Tables']['invitations']['Row'];

const NOW = new Date('2026-07-07T00:00:00.000Z');
const FUTURE = '2026-07-08T00:00:00.000Z';
const PAST = '2026-07-06T00:00:00.000Z';
const TOKEN = 'plaintext-invite-token';

function invitation(overrides: Partial<InvitationRow> = {}): InvitationRow {
  return {
    id: 'invite-123',
    invitee_email: 'invitee@example.com',
    inviter_identity_id: 'identity-inviter',
    community_id: 'community-123',
    token_hash: hashInviteToken(TOKEN),
    status: 'pending',
    redemption_status: 'not_redeemed',
    expires_at: FUTURE,
    redeemed_at: null,
    redeemed_by_identity_id: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('invite lifecycle helpers', () => {
  it('creates an invite payload with hashed token storage', () => {
    const result = createInvitePayload({
      inviteeEmail: 'invitee@example.com',
      inviterIdentityId: 'identity-inviter',
      communityId: 'community-123',
      token: TOKEN,
      now: NOW,
    });

    expect(result.plaintextToken).toBe(TOKEN);
    expect(result.payload).toMatchObject({
      invitee_email: 'invitee@example.com',
      inviter_identity_id: 'identity-inviter',
      community_id: 'community-123',
      status: 'pending',
      redemption_status: 'not_redeemed',
      expires_at: '2026-07-14T00:00:00.000Z',
    });
    expect(result.payload.token_hash).toBe(hashInviteToken(TOKEN));
    expect(result.payload.token_hash).not.toBe(TOKEN);
  });

  it('pending invite is valid before expiration', () => {
    const result = validateInviteForRedemption({ invite: invitation(), token: TOKEN, now: NOW });

    expect(result).toEqual({
      valid: true,
      invite: {
        id: 'invite-123',
        inviteeEmail: 'invitee@example.com',
        communityId: 'community-123',
        expiresAt: FUTURE,
      },
    });
  });

  it('expired invite is invalid', () => {
    const result = validateInviteForRedemption({
      invite: invitation({ expires_at: PAST }),
      token: TOKEN,
      now: NOW,
    });

    expect(result).toEqual({ valid: false, reason: 'expired' });
  });

  it('revoked invite is invalid', () => {
    const revokedPayload = markInviteRevokedPayload({ revokedAt: NOW });
    const result = validateInviteForRedemption({
      invite: invitation(revokedPayload),
      token: TOKEN,
      now: NOW,
    });

    expect(revokedPayload).toEqual({
      status: 'revoked',
      redemption_status: 'blocked',
      updated_at: '2026-07-07T00:00:00.000Z',
    });
    expect(result).toEqual({ valid: false, reason: 'revoked' });
  });

  it('redeemed invite is invalid for reuse', () => {
    const redeemedPayload = markInviteRedeemedPayload({
      redeemedByIdentityId: 'identity-redeemer',
      redeemedAt: NOW,
    });
    const result = validateInviteForRedemption({
      invite: invitation(redeemedPayload),
      token: TOKEN,
      now: NOW,
    });

    expect(redeemedPayload).toEqual({
      status: 'accepted',
      redemption_status: 'redeemed',
      redeemed_by_identity_id: 'identity-redeemer',
      redeemed_at: '2026-07-07T00:00:00.000Z',
    });
    expect(result).toEqual({ valid: false, reason: 'redeemed' });
  });

  it('plaintext invite token is never returned from validation helpers', () => {
    const validResult = validateInviteForRedemption({
      invite: invitation(),
      token: TOKEN,
      now: NOW,
    });
    const invalidResult = validateInviteForRedemption({
      invite: invitation(),
      token: 'wrong-token',
      now: NOW,
    });

    expect(JSON.stringify(validResult)).not.toContain(TOKEN);
    expect(JSON.stringify(validResult)).not.toContain('token_hash');
    expect(JSON.stringify(validResult)).not.toContain('identity-inviter');
    expect(JSON.stringify(invalidResult)).not.toContain('wrong-token');
    expect(JSON.stringify(invalidResult)).not.toContain(TOKEN);
  });

  it('invite hash comparison uses existing token helpers', () => {
    const compareSpy = vi.spyOn(inviteTokens, 'compareInviteTokenHash');

    validateInviteForRedemption({ invite: invitation(), token: TOKEN, now: NOW });

    expect(compareSpy).toHaveBeenCalledWith(TOKEN, hashInviteToken(TOKEN));
    compareSpy.mockRestore();
  });
});
