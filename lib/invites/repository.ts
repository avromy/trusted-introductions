import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

import {
  createInvitePayload,
  markInviteRedeemedPayload,
  markInviteRevokedPayload,
  type CreateInvitePayloadInput,
  type CreateInvitePayloadResult,
  type MarkInviteRedeemedInput,
  type MarkInviteRevokedInput,
} from './lifecycle';
import type { InviteTokenHash } from './tokens';

export type InvitationRow = Database['public']['Tables']['invitations']['Row'];
type InviteQueryResult<T> = Promise<{ data: T; error: { message?: string } | null }>;

type InviteQueryBuilder<T> = {
  select(columns: string): InviteQueryBuilder<T>;
  insert(payload: unknown): InviteQueryBuilder<T>;
  update(payload: unknown): InviteQueryBuilder<T>;
  eq(column: string, value: unknown): InviteQueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): InviteQueryResult<T[]>;
  maybeSingle(): InviteQueryResult<T | null>;
  single(): InviteQueryResult<T>;
};

export type InviteRepositoryClient = {
  from(table: 'invitations'): InviteQueryBuilder<InvitationRow>;
};

export interface InsertInviteResult {
  invite: InvitationRow;
  plaintextToken: CreateInvitePayloadResult['plaintextToken'];
}

export interface UpdateInviteRedeemedRepositoryInput extends MarkInviteRedeemedInput {
  inviteId: string;
}

export interface UpdateInviteRevokedRepositoryInput extends MarkInviteRevokedInput {
  inviteId: string;
}

function getInviteRepositoryClient(client?: InviteRepositoryClient): InviteRepositoryClient {
  return client ?? (createClient() as unknown as InviteRepositoryClient);
}

function throwInviteRepositoryError(operation: string, error: { message?: string }): never {
  throw new Error(`Failed to ${operation}: ${error.message ?? 'unknown Supabase error'}`);
}

export async function getInviteByTokenHash(
  tokenHash: InviteTokenHash,
  client?: InviteRepositoryClient,
): Promise<InvitationRow | null> {
  const { data, error } = await getInviteRepositoryClient(client)
    .from('invitations')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) {
    throwInviteRepositoryError('get invite by token hash', error);
  }

  return data;
}

export async function insertInvite(
  input: CreateInvitePayloadInput,
  client?: InviteRepositoryClient,
): Promise<InsertInviteResult> {
  const { plaintextToken, payload } = createInvitePayload(input);
  const { data, error } = await getInviteRepositoryClient(client)
    .from('invitations')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throwInviteRepositoryError('insert invite', error);
  }

  return { invite: data, plaintextToken };
}

export async function updateInviteRedeemed(
  input: UpdateInviteRedeemedRepositoryInput,
  client?: InviteRepositoryClient,
): Promise<InvitationRow> {
  const { inviteId, ...lifecycleInput } = input;
  const { data, error } = await getInviteRepositoryClient(client)
    .from('invitations')
    .update(markInviteRedeemedPayload(lifecycleInput))
    .eq('id', inviteId)
    .select('*')
    .single();

  if (error) {
    throwInviteRepositoryError('mark invite redeemed', error);
  }

  return data;
}

export async function updateInviteRevoked(
  input: UpdateInviteRevokedRepositoryInput,
  client?: InviteRepositoryClient,
): Promise<InvitationRow> {
  const { inviteId, ...lifecycleInput } = input;
  const { data, error } = await getInviteRepositoryClient(client)
    .from('invitations')
    .update(markInviteRevokedPayload(lifecycleInput))
    .eq('id', inviteId)
    .select('*')
    .single();

  if (error) {
    throwInviteRepositoryError('mark invite revoked', error);
  }

  return data;
}

export async function listInvitesByInviterIdentity(
  inviterIdentityId: string,
  client?: InviteRepositoryClient,
): Promise<InvitationRow[]> {
  const { data, error } = await getInviteRepositoryClient(client)
    .from('invitations')
    .select('*')
    .eq('inviter_identity_id', inviterIdentityId)
    .order('created_at', { ascending: false });

  if (error) {
    throwInviteRepositoryError('list invites by inviter identity', error);
  }

  return data ?? [];
}
