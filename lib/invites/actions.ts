'use server';

import { createAuditEventPayload } from '@/lib/audit';
import { insertAuditEvent, type AuditEventsSupabaseClient } from '@/lib/audit/server';
import {
  requireCurrentIdentity,
  type AuthIdentity,
  type SupabaseAuthClient,
} from '@/lib/auth/session';
import {
  createInvitePayload,
  validateInviteForRedemption,
  type SafeInviteValidationResult,
} from '@/lib/invites/lifecycle';
import { getInviteByTokenHash, type InviteRepositoryClient } from '@/lib/invites/repository';
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

export type InviteValidationSupabaseClient = InviteRepositoryClient;

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

interface ValidateInviteTokenActionDependencies {
  supabase?: InviteValidationSupabaseClient;
  now?: Date;
}

export type InviteValidationActionResult =
  | SafeInviteValidationResult
  | {
      valid: false;
      reason: 'missing_token' | 'not_found';
    };

function getServerClient(): InviteCreationSupabaseClient {
  return createClient() as unknown as InviteCreationSupabaseClient;
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
