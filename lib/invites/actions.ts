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
  markInviteRedeemedPayload,
  validateInviteForRedemption,
} from '@/lib/invites/lifecycle';
import { hashInviteToken } from '@/lib/invites/tokens';
import { createClient } from '@/lib/supabase/server';
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

export interface CreateInviteActionInput {
  inviteeEmail: string;
  communityId?: string | null;
  expiresAt?: Date | string | null;
}

export interface CreateInviteActionResult {
  inviteId: string;
  plaintextToken: string;
  expiresAt: string | null;
}

interface CreateInviteActionDependencies {
  supabase?: InviteCreationSupabaseClient;
  now?: Date;
}

function getServerClient(): InviteCreationSupabaseClient {
  return createClient() as unknown as InviteCreationSupabaseClient;
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

function normalizeExpiresAt(
  expiresAt: CreateInviteActionInput['expiresAt'],
): Date | null | undefined {
  if (expiresAt === undefined || expiresAt === null) {
    return expiresAt;
  }

  return expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
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

type InviteRedemptionErrorCode =
  | 'invalid_token'
  | 'auth_required'
  | 'invite_not_found'
  | 'invite_expired'
  | 'invite_revoked'
  | 'invite_redeemed'
  | 'invite_blocked'
  | 'invite_token_mismatch'
  | 'redemption_failed'
  | 'audit_failed';

export type RedeemInviteActionResult =
  | {
      ok: true;
      invite: {
        id: string;
        inviteeEmail: string;
        communityId: string | null;
        redeemedAt: string;
      };
    }
  | {
      ok: false;
      code: InviteRedemptionErrorCode;
      message: string;
    };

type InviteRedemptionSupabaseClient = Parameters<typeof requireCurrentIdentity>[0] &
  AuditEventsSupabaseClient & {
    from(table: 'invitations'): {
      select(columns: string): {
        eq(column: string, value: string): {
          maybeSingle(): Promise<{ data: InvitationRow | null; error: { message?: string } | null }>;
        };
      };
      update(payload: ReturnType<typeof markInviteRedeemedPayload>): {
        eq(column: string, value: string): {
          eq(column: string, value: string): {
            is(column: string, value: null): {
              select(columns: string): {
                single(): Promise<{ data: InvitationRow | null; error: { message?: string } | null }>;
              };
            };
          };
        };
      };
    };
  };

const INVITE_SELECT_COLUMNS =
  'id, invitee_email, inviter_identity_id, community_id, token_hash, status, redemption_status, expires_at, redeemed_at, redeemed_by_identity_id, created_at, updated_at';

function safeRedemptionError(code: InviteRedemptionErrorCode, message: string): RedeemInviteActionResult {
  return { ok: false, code, message };
}

function identityIdFrom(identity: Awaited<ReturnType<typeof requireCurrentIdentity>>): string | null {
  const identityId = identity.identity_id ?? identity.id ?? null;
  return identityId?.trim() || null;
}

function validationCode(
  reason: 'expired' | 'revoked' | 'redeemed' | 'blocked' | 'token_mismatch',
): InviteRedemptionErrorCode {
  return `invite_${reason}`;
}

export async function redeemInviteAction(token: string): Promise<RedeemInviteActionResult> {
  const trimmedToken = typeof token === 'string' ? token.trim() : '';

  if (!trimmedToken) {
    return safeRedemptionError('invalid_token', 'A valid invite token is required.');
  }

  const supabase = createClient() as unknown as InviteRedemptionSupabaseClient;
  let identityId: string;

  try {
    const identity = await requireCurrentIdentity(supabase);
    const currentIdentityId = identityIdFrom(identity);

    if (!currentIdentityId) {
      return safeRedemptionError('auth_required', 'A signed-in user identity is required.');
    }

    identityId = currentIdentityId;
  } catch (error) {
    if (error instanceof AuthHelperError) {
      return safeRedemptionError('auth_required', error.message);
    }

    return safeRedemptionError('auth_required', 'A signed-in user identity is required.');
  }

  const { data: invite, error: lookupError } = await supabase
    .from('invitations')
    .select(INVITE_SELECT_COLUMNS)
    .eq('token_hash', hashInviteToken(trimmedToken))
    .maybeSingle();

  if (lookupError) {
    return safeRedemptionError('redemption_failed', 'Unable to load the invite for redemption.');
  }

  if (!invite) {
    return safeRedemptionError('invite_not_found', 'Invite token was not found.');
  }

  const validation = validateInviteForRedemption({ invite, token: trimmedToken });

  if (!validation.valid) {
    return safeRedemptionError(validationCode(validation.reason), 'Invite cannot be redeemed.');
  }

  const redemptionPayload = markInviteRedeemedPayload({ redeemedByIdentityId: identityId });
  const { data: redeemedInvite, error: redeemError } = await supabase
    .from('invitations')
    .update(redemptionPayload)
    .eq('id', invite.id)
    .eq('redemption_status', 'not_redeemed')
    .is('redeemed_at', null)
    .select(INVITE_SELECT_COLUMNS)
    .single();

  if (redeemError || !redeemedInvite) {
    return safeRedemptionError('redemption_failed', 'Invite could not be redeemed.');
  }

  try {
    await insertAuditEvent(
      supabase,
      createAuditEventPayload({
        eventType: 'invite.accepted',
        actor: { type: 'user', id: identityId },
        target: { type: 'invite', id: redeemedInvite.id },
        metadata: {
          communityId: redeemedInvite.community_id,
          inviteeEmail: redeemedInvite.invitee_email,
        },
      }),
    );
  } catch {
    return safeRedemptionError(
      'audit_failed',
      'Invite was redeemed, but the audit event could not be written.',
    );
  }

  return {
    ok: true,
    invite: {
      id: redeemedInvite.id,
      inviteeEmail: redeemedInvite.invitee_email,
      communityId: redeemedInvite.community_id,
      redeemedAt: redeemedInvite.redeemed_at ?? redemptionPayload.redeemed_at,
    },
  };
}
