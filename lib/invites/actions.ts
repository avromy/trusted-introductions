'use server';

import { createAuditEventPayload } from '@/lib/audit';
import { insertAuditEvent, type AuditEventsSupabaseClient } from '@/lib/audit/server';
import {
  AuthHelperError,
  requireCurrentIdentity,
  type AuthIdentity,
  type SupabaseAuthClient,
} from '@/lib/auth/session';
import {
  createInvitePayload,
  validateInviteForRedemption,
  type SafeInviteValidationDetails,
  type SafeInviteValidationResult,
} from '@/lib/invites/lifecycle';
import {
  getInviteByTokenHash,
  updateInviteRedeemed,
  updateInviteRevoked,
  type InviteRepositoryClient,
} from '@/lib/invites/repository';
import { hashInviteToken } from '@/lib/invites/tokens';
import { createClient } from '@/lib/supabase/server';
import {
  RateLimitExceededError,
  assertRateLimitAllowed,
  getRateLimiter,
  hashScopedIdentifier,
  rateLimitRules,
  scopedRateLimitKey,
  toSafeRateLimitedValidationResult,
  type RateLimiter,
} from '@/lib/security/rate-limit';
import type { Database } from '@/types/supabase';

type InvitationRow = Database['public']['Tables']['invitations']['Row'];

type InvitationInsertResult = {
  data: Pick<InvitationRow, 'id'> | null;
  error: Error | null;
};

type InvitationInsertPayload = ReturnType<typeof createInvitePayload>['payload'];

export type InviteCreationSupabaseClient = SupabaseAuthClient &
  AuditEventsSupabaseClient & {
    from(table: 'invitations'): {
      insert(payload: InvitationInsertPayload): {
        select(columns: 'id'): {
          single(): Promise<InvitationInsertResult>;
        };
      };
    };
  };

export type InviteRedemptionSupabaseClient = SupabaseAuthClient &
  AuditEventsSupabaseClient &
  InviteRepositoryClient;

export type InviteRevocationSupabaseClient = SupabaseAuthClient &
  AuditEventsSupabaseClient &
  InviteRepositoryClient;

export type InviteValidationSupabaseClient = InviteRepositoryClient;

export type RedeemInviteActionFailureReason =
  'invalid-token' | 'auth-required' | 'expired' | 'revoked' | 'redeemed' | 'blocked';

export type RedeemInviteActionResult =
  | {
      ok: true;
      invite: SafeInviteValidationDetails & {
        redeemedAt: string;
        redeemedByIdentityId: string;
      };
    }
  | {
      ok: false;
      reason: RedeemInviteActionFailureReason;
    };

export interface CreateInviteActionInput {
  inviteeEmail: string;
  communityId?: string | null;
  expiresAt?: Date | string | null;
}

export type CreateInviteActionResult = {
  inviteId: string;
  plaintextToken: string;
  expiresAt: string | null;
  ok?: false;
  error?: 'rate_limited';
  message?: string;
};

export type RevokeInviteActionResult =
  | {
      ok: true;
      invite: {
        id: string;
        status: InvitationRow['status'];
        redemptionStatus: InvitationRow['redemption_status'];
        revokedAt: string;
      };
    }
  | {
      ok: false;
      error: 'validation_failed' | 'auth_required' | 'not_found';
      message: string;
    };

export type InviteValidationActionResult =
  | SafeInviteValidationResult
  | {
      valid: false;
      reason: 'missing_token' | 'not_found' | 'rate_limited';
    };

interface CreateInviteActionDependencies {
  supabase?: InviteCreationSupabaseClient;
  rateLimiter?: RateLimiter;
  now?: Date;
}

interface RedeemInviteActionDependencies {
  supabase?: InviteRedemptionSupabaseClient;
  rateLimiter?: RateLimiter;
  now?: Date;
}

interface ValidateInviteTokenActionDependencies {
  supabase?: InviteValidationSupabaseClient;
  rateLimiter?: RateLimiter;
  now?: Date;
}

function getServerClient(): InviteCreationSupabaseClient {
  return createClient() as unknown as InviteCreationSupabaseClient;
}

function getRedemptionServerClient(): InviteRedemptionSupabaseClient {
  return createClient() as unknown as InviteRedemptionSupabaseClient;
}

function getServerRevocationClient(): InviteRevocationSupabaseClient {
  return createClient() as unknown as InviteRevocationSupabaseClient;
}

function getInviteValidationServerClient(): InviteValidationSupabaseClient {
  return createClient() as unknown as InviteValidationSupabaseClient;
}

function getIdentityId(identity: AuthIdentity): string {
  const identityId = identity.identity_id ?? identity.id ?? identity.user_id;

  if (!identityId?.trim()) {
    throw new Error('Authenticated identity is missing an id.');
  }

  return identityId;
}

function normalizeInviteeEmail(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error('Invitee email is required.');
  }

  return normalizedEmail;
}

function normalizeInviteId(inviteId: string): string | null {
  const normalizedInviteId = inviteId.trim();

  return normalizedInviteId ? normalizedInviteId : null;
}

function normalizeExpiresAt(
  expiresAt: CreateInviteActionInput['expiresAt'],
): Date | null | undefined {
  if (expiresAt === undefined || expiresAt === null) {
    return expiresAt;
  }

  return expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
}

function normalizeInviteToken(token: string): string | null {
  const normalizedToken = token.trim();

  return normalizedToken.length > 0 ? normalizedToken : null;
}

async function insertInvite(
  supabase: InviteCreationSupabaseClient,
  payload: InvitationInsertPayload,
): Promise<Pick<InvitationRow, 'id'>> {
  const { data, error } = await supabase.from('invitations').insert(payload).select('id').single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Invite creation did not return an invite id.');
  }

  return data;
}

export async function createInviteAction(
  input: CreateInviteActionInput,
  dependencies: CreateInviteActionDependencies = {},
): Promise<CreateInviteActionResult> {
  const supabase = dependencies.supabase ?? getServerClient();
  const identity = await requireCurrentIdentity(supabase);
  const inviterIdentityId = getIdentityId(identity);
  const now = dependencies.now ?? new Date();
  const rateLimiter = dependencies.rateLimiter ?? getRateLimiter();

  try {
    await assertRateLimitAllowed(
      rateLimiter,
      rateLimitRules.inviteCreation,
      scopedRateLimitKey('invite-creation', inviterIdentityId),
      now,
    );
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return {
        inviteId: '',
        plaintextToken: '',
        expiresAt: null,
        ok: false,
        error: 'rate_limited',
        message: 'Too many attempts. Please wait before trying again.',
      };
    }

    throw error;
  }
  const invite = createInvitePayload({
    inviteeEmail: normalizeInviteeEmail(input.inviteeEmail),
    inviterIdentityId,
    communityId: input.communityId,
    now,
    expiresAt: normalizeExpiresAt(input.expiresAt),
  });

  const createdInvite = await insertInvite(supabase, invite.payload);

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'invite.created',
      actor: { type: 'user', id: inviterIdentityId },
      target: { type: 'invite', id: createdInvite.id },
      metadata: {
        communityId: invite.payload.community_id,
        inviteeEmail: invite.payload.invitee_email,
        expiresAt: invite.payload.expires_at,
      },
      occurredAt: now,
    }),
  );

  return {
    inviteId: createdInvite.id,
    plaintextToken: invite.plaintextToken,
    expiresAt: invite.payload.expires_at,
  };
}

export async function validateInviteTokenAction(
  token: string | null | undefined,
  dependencies: ValidateInviteTokenActionDependencies = {},
): Promise<InviteValidationActionResult> {
  const normalizedToken = token?.trim();

  if (!normalizedToken) {
    return { valid: false, reason: 'missing_token' };
  }

  const supabase = dependencies.supabase ?? getInviteValidationServerClient();
  const tokenHash = hashInviteToken(normalizedToken);
  const rateLimiter = dependencies.rateLimiter ?? getRateLimiter();

  try {
    await assertRateLimitAllowed(
      rateLimiter,
      rateLimitRules.inviteValidation,
      scopedRateLimitKey('invite-validation', hashScopedIdentifier('invite-token', tokenHash)),
      dependencies.now,
    );
  } catch (error) {
    if (error instanceof RateLimitExceededError) return toSafeRateLimitedValidationResult();
    throw error;
  }
  const invite = await getInviteByTokenHash(tokenHash, supabase);

  if (!invite) {
    return { valid: false, reason: 'not_found' };
  }

  return validateInviteForRedemption({
    invite,
    token: normalizedToken,
    now: dependencies.now,
  });
}

function isAuthRequiredError(error: unknown): boolean {
  return (
    error instanceof AuthHelperError &&
    (error.code === 'AUTH_REQUIRED' || error.code === 'AUTH_IDENTITY_REQUIRED')
  );
}

export async function redeemInviteAction(
  token: string,
  dependencies: RedeemInviteActionDependencies = {},
): Promise<RedeemInviteActionResult> {
  const normalizedToken = normalizeInviteToken(token);

  if (!normalizedToken) {
    return { ok: false, reason: 'invalid-token' };
  }

  const supabase = dependencies.supabase ?? getRedemptionServerClient();
  const now = dependencies.now ?? new Date();
  let identity: AuthIdentity;

  try {
    identity = await requireCurrentIdentity(supabase);
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return { ok: false, reason: 'auth-required' };
    }

    throw error;
  }

  const redeemedByIdentityId = getIdentityId(identity);
  const tokenHash = hashInviteToken(normalizedToken);
  const rateLimiter = dependencies.rateLimiter ?? getRateLimiter();

  try {
    await assertRateLimitAllowed(
      rateLimiter,
      rateLimitRules.inviteRedemption,
      scopedRateLimitKey(
        'invite-redemption',
        redeemedByIdentityId,
        hashScopedIdentifier('invite-token', tokenHash),
      ),
      now,
    );
  } catch (error) {
    if (error instanceof RateLimitExceededError) return { ok: false, reason: 'invalid-token' };
    throw error;
  }

  const invite = await getInviteByTokenHash(tokenHash, supabase);

  if (!invite) {
    return { ok: false, reason: 'invalid-token' };
  }

  const validation = validateInviteForRedemption({ invite, token: normalizedToken, now });

  if (!validation.valid) {
    return {
      ok: false,
      reason: validation.reason === 'token_mismatch' ? 'invalid-token' : validation.reason,
    };
  }

  const redeemedInvite = await updateInviteRedeemed(
    {
      inviteId: invite.id,
      redeemedByIdentityId,
      redeemedAt: now,
    },
    supabase,
  );

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'invite.accepted',
      actor: { type: 'user', id: redeemedByIdentityId },
      target: { type: 'invite', id: redeemedInvite.id },
      metadata: {
        communityId: redeemedInvite.community_id,
        inviteeEmail: redeemedInvite.invitee_email,
        redeemedAt: redeemedInvite.redeemed_at,
      },
      occurredAt: now,
    }),
  );

  return {
    ok: true,
    invite: {
      ...validation.invite,
      redeemedAt: redeemedInvite.redeemed_at ?? now.toISOString(),
      redeemedByIdentityId,
    },
  };
}

function isInviteNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /0 rows|no rows|not found|multiple \(or no\) rows|JSON object requested/i.test(error.message)
  );
}

export async function revokeInviteAction(
  inviteId: string,
  dependencies: { supabase?: InviteRevocationSupabaseClient; now?: Date } = {},
): Promise<RevokeInviteActionResult> {
  const normalizedInviteId = normalizeInviteId(inviteId);

  if (!normalizedInviteId) {
    return {
      ok: false,
      error: 'validation_failed',
      message: 'Invite id is required.',
    };
  }

  const supabase = dependencies.supabase ?? getServerRevocationClient();
  const now = dependencies.now ?? new Date();
  let actorIdentityId: string;

  try {
    actorIdentityId = getIdentityId(await requireCurrentIdentity(supabase));
  } catch (error) {
    if (error instanceof AuthHelperError) {
      return {
        ok: false,
        error: 'auth_required',
        message: 'A signed-in trusted identity is required to revoke an invite.',
      };
    }

    throw error;
  }

  let revokedInvite: InvitationRow;

  try {
    revokedInvite = await updateInviteRevoked(
      { inviteId: normalizedInviteId, revokedAt: now },
      supabase,
    );
  } catch (error) {
    if (isInviteNotFoundError(error)) {
      return {
        ok: false,
        error: 'not_found',
        message: 'Invite not found.',
      };
    }

    throw error;
  }

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'invite.revoked',
      actor: { type: 'user', id: actorIdentityId },
      target: { type: 'invite', id: revokedInvite.id },
      metadata: {
        inviteeEmail: revokedInvite.invitee_email,
        communityId: revokedInvite.community_id,
        revokedAt: now.toISOString(),
      },
      occurredAt: now,
    }),
  );

  return {
    ok: true,
    invite: {
      id: revokedInvite.id,
      status: revokedInvite.status,
      redemptionStatus: revokedInvite.redemption_status,
      revokedAt: revokedInvite.updated_at,
    },
  };
}
