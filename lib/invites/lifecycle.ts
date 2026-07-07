import type { Database } from '@/types/supabase';

import * as inviteTokens from './tokens';
import type { InviteTokenHash } from './tokens';

type InvitationRow = Database['public']['Tables']['invitations']['Row'];
type InvitationStatus = Database['public']['Enums']['invitation_status'];
type InviteRedemptionStatus = Database['public']['Enums']['invite_redemption_status'];

export type InviteLifecycleReason =
  'expired' | 'revoked' | 'redeemed' | 'blocked' | 'token_mismatch';

export interface CreateInvitePayloadInput {
  inviteeEmail: string;
  inviterIdentityId?: string | null;
  communityId?: string | null;
  token?: string;
  now?: Date;
  expiresAt?: Date | null;
}

export interface CreateInvitePayloadResult {
  plaintextToken: string;
  payload: {
    invitee_email: string;
    inviter_identity_id: string | null;
    community_id: string | null;
    token_hash: InviteTokenHash;
    status: Extract<InvitationStatus, 'pending'>;
    redemption_status: Extract<InviteRedemptionStatus, 'not_redeemed'>;
    expires_at: string | null;
  };
}

export interface SafeInviteValidationDetails {
  id: string;
  inviteeEmail: string;
  communityId: string | null;
  expiresAt: string | null;
}

export type SafeInviteValidationResult =
  | {
      valid: true;
      invite: SafeInviteValidationDetails;
    }
  | {
      valid: false;
      reason: InviteLifecycleReason;
    };

export interface ValidateInviteInput {
  invite: Pick<
    InvitationRow,
    | 'id'
    | 'invitee_email'
    | 'community_id'
    | 'expires_at'
    | 'redeemed_at'
    | 'redemption_status'
    | 'status'
    | 'token_hash'
  >;
  token: string;
  now?: Date;
}

export interface MarkInviteRedeemedInput {
  redeemedByIdentityId: string;
  redeemedAt?: Date;
}

export interface MarkInviteRevokedInput {
  revokedAt?: Date;
}

export function createInvitePayload(input: CreateInvitePayloadInput): CreateInvitePayloadResult {
  const plaintextToken = input.token ?? inviteTokens.generateInviteToken();
  const expiresAt =
    input.expiresAt === undefined
      ? inviteTokens.getInviteExpirationDate(input.now)
      : input.expiresAt;

  return {
    plaintextToken,
    payload: {
      invitee_email: input.inviteeEmail,
      inviter_identity_id: input.inviterIdentityId ?? null,
      community_id: input.communityId ?? null,
      token_hash: inviteTokens.hashInviteToken(plaintextToken),
      status: 'pending',
      redemption_status: 'not_redeemed',
      expires_at: expiresAt?.toISOString() ?? null,
    },
  };
}

export function isInviteExpired(
  invite: Pick<InvitationRow, 'expires_at'>,
  now: Date = new Date(),
): boolean {
  return invite.expires_at !== null && new Date(invite.expires_at).getTime() <= now.getTime();
}

export function getInviteInvalidReason(
  invite: Pick<InvitationRow, 'expires_at' | 'redeemed_at' | 'redemption_status' | 'status'>,
  now: Date = new Date(),
): Exclude<InviteLifecycleReason, 'token_mismatch'> | null {
  if (invite.status === 'revoked') {
    return 'revoked';
  }

  if (invite.redemption_status === 'blocked') {
    return 'blocked';
  }

  if (
    invite.status === 'accepted' ||
    invite.redemption_status === 'redeemed' ||
    invite.redeemed_at !== null
  ) {
    return 'redeemed';
  }

  if (invite.status === 'expired' || isInviteExpired(invite, now)) {
    return 'expired';
  }

  return null;
}

export function isInviteValidForRedemption(
  invite: Pick<InvitationRow, 'expires_at' | 'redeemed_at' | 'redemption_status' | 'status'>,
  now: Date = new Date(),
): boolean {
  return getInviteInvalidReason(invite, now) === null;
}

export function validateInviteForRedemption(
  input: ValidateInviteInput,
): SafeInviteValidationResult {
  const invalidReason = getInviteInvalidReason(input.invite, input.now);

  if (invalidReason !== null) {
    return { valid: false, reason: invalidReason };
  }

  if (
    !inviteTokens.compareInviteTokenHash(input.token, input.invite.token_hash as InviteTokenHash)
  ) {
    return { valid: false, reason: 'token_mismatch' };
  }

  return {
    valid: true,
    invite: {
      id: input.invite.id,
      inviteeEmail: input.invite.invitee_email,
      communityId: input.invite.community_id,
      expiresAt: input.invite.expires_at,
    },
  };
}

export function markInviteRedeemedPayload(input: MarkInviteRedeemedInput): {
  redeemed_at: string;
  redeemed_by_identity_id: string;
  redemption_status: Extract<InviteRedemptionStatus, 'redeemed'>;
  status: Extract<InvitationStatus, 'accepted'>;
} {
  return {
    redeemed_at: (input.redeemedAt ?? new Date()).toISOString(),
    redeemed_by_identity_id: input.redeemedByIdentityId,
    redemption_status: 'redeemed',
    status: 'accepted',
  };
}

export function markInviteRevokedPayload(input: MarkInviteRevokedInput = {}): {
  redemption_status: Extract<InviteRedemptionStatus, 'blocked'>;
  status: Extract<InvitationStatus, 'revoked'>;
  updated_at: string;
} {
  return {
    redemption_status: 'blocked',
    status: 'revoked',
    updated_at: (input.revokedAt ?? new Date()).toISOString(),
  };
}
