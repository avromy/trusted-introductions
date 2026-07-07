'use server';

import { createAuditEventPayload } from '@/lib/audit';
import { insertAuditEvent, type AuditEventsSupabaseClient } from '@/lib/audit/server';
import {
  AuthHelperError,
  requireCurrentIdentity,
  type AuthIdentity,
  type SupabaseAuthClient,
} from '@/lib/auth/session';
import { createInvitePayload } from '@/lib/invites/lifecycle';
import { updateInviteRevoked, type InviteRepositoryClient } from '@/lib/invites/repository';
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

export type InviteRevocationSupabaseClient = SupabaseAuthClient &
  AuditEventsSupabaseClient &
  InviteRepositoryClient;

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

interface CreateInviteActionDependencies {
  supabase?: InviteCreationSupabaseClient;
  now?: Date;
}

function getServerClient(): InviteCreationSupabaseClient {
  return createClient() as unknown as InviteCreationSupabaseClient;
}

function getServerRevocationClient(): InviteRevocationSupabaseClient {
  return createClient() as unknown as InviteRevocationSupabaseClient;
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

function isInviteNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /0 rows|no rows|not found|multiple \\(or no\\) rows|JSON object requested/i.test(error.message)
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
