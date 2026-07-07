'use server';

import { createAuditEventPayload } from '@/lib/audit';
import { insertAuditEvent, type AuditEventsSupabaseClient } from '@/lib/audit/server';
import {
  requireCurrentIdentity,
  type AuthIdentity,
  type SupabaseAuthClient,
} from '@/lib/auth/session';
import { createInvitePayload, markInviteRevokedPayload } from '@/lib/invites/lifecycle';
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

export type RevokeInviteActionErrorCode =
  | 'AUTH_REQUIRED'
  | 'INVITE_ID_REQUIRED'
  | 'INVITE_NOT_FOUND'
  | 'INVITE_REVOKE_FAILED'
  | 'AUDIT_WRITE_FAILED';

export type RevokeInviteActionResult =
  | {
      ok: true;
      invite: {
        id: string;
        status: 'revoked';
        redemptionStatus: 'blocked';
      };
    }
  | {
      ok: false;
      error: {
        code: RevokeInviteActionErrorCode;
        message: string;
      };
    };

type InviteRevocationSupabaseClient = AuditEventsSupabaseClient &
  Parameters<typeof requireCurrentIdentity>[0] & {
    from(table: 'invitations'): {
      update(payload: ReturnType<typeof markInviteRevokedPayload>): {
        eq(column: 'id', value: string): {
          select(columns: 'id,status,redemption_status'): {
            single(): Promise<{
              data: { id: string; status: 'revoked'; redemption_status: 'blocked' } | null;
              error: { code?: string; message?: string } | null;
            }>;
          };
        };
      };
    };
  };

function safeRevokeError(code: RevokeInviteActionErrorCode, message: string): RevokeInviteActionResult {
  return { ok: false, error: { code, message } };
}

function isNotFoundError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === 'PGRST116';
}

export async function revokeInviteAction(inviteId: string): Promise<RevokeInviteActionResult> {
  const trimmedInviteId = inviteId.trim();

  if (!trimmedInviteId) {
    return safeRevokeError('INVITE_ID_REQUIRED', 'Invite id is required.');
  }

  const supabase = createClient() as unknown as InviteRevocationSupabaseClient;
  let actorIdentityId: string;

  try {
    const identity = await requireCurrentIdentity(supabase);
    actorIdentityId = getIdentityId(identity);
  } catch {
    return safeRevokeError('AUTH_REQUIRED', 'A signed-in identity is required to revoke an invite.');
  }

  const { data, error } = await supabase
    .from('invitations')
    .update(markInviteRevokedPayload())
    .eq('id', trimmedInviteId)
    .select('id,status,redemption_status')
    .single();

  if (error) {
    if (isNotFoundError(error)) {
      return safeRevokeError('INVITE_NOT_FOUND', 'Invite was not found.');
    }

    return safeRevokeError('INVITE_REVOKE_FAILED', 'Invite could not be revoked.');
  }

  if (!data) {
    return safeRevokeError('INVITE_NOT_FOUND', 'Invite was not found.');
  }

  try {
    await insertAuditEvent(
      supabase,
      createAuditEventPayload({
        eventType: 'invite.revoked',
        actor: { type: 'user', id: actorIdentityId },
        target: { type: 'invite', id: data.id },
        metadata: { inviteId: data.id },
      }),
    );
  } catch {
    return safeRevokeError(
      'AUDIT_WRITE_FAILED',
      'Invite was revoked, but the audit event could not be written.',
    );
  }

  return {
    ok: true,
    invite: {
      id: data.id,
      status: data.status,
      redemptionStatus: data.redemption_status,
    },
  };
}
