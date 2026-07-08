import { createClient } from '@/lib/supabase/server';

export const INTRODUCTION_STATUSES = ['created', 'sent', 'accepted', 'declined', 'closed'] as const;

export type IntroductionStatus = (typeof INTRODUCTION_STATUSES)[number];

export interface Introduction {
  id: string;
  matchId: string;
  requesterIdentityId: string;
  helperIdentityId: string;
  stewardIdentityId: string;
  status: IntroductionStatus;
  stewardNote: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
}

export interface IntroductionRow {
  id: string;
  match_id: string;
  requester_identity_id: string;
  helper_identity_id: string;
  steward_identity_id: string;
  status: IntroductionStatus;
  steward_note: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
}

export interface CreateIntroductionInput {
  matchId: string;
  requesterIdentityId: string;
  helperIdentityId: string;
  stewardIdentityId: string;
  stewardNote?: string | null;
  now?: Date | string;
}

type QueryResult<T> = Promise<{ data: T; error: { message?: string } | Error | null }>;

type IntroductionQueryBuilder<T> = {
  select(columns?: string): IntroductionQueryBuilder<T>;
  insert(payload: unknown): IntroductionQueryBuilder<T>;
  update(payload: unknown): IntroductionQueryBuilder<T>;
  eq(column: string, value: unknown): IntroductionQueryBuilder<T>;
  maybeSingle(): QueryResult<T | null>;
  single(): QueryResult<T>;
};

export type IntroductionRepositoryClient = {
  from(table: 'introductions'): IntroductionQueryBuilder<IntroductionRow>;
};

function getIntroductionRepositoryClient(
  client?: IntroductionRepositoryClient,
): IntroductionRepositoryClient {
  return client ?? (createClient() as unknown as IntroductionRepositoryClient);
}

function throwIntroductionRepositoryError(operation: string, error: { message?: string } | Error): never {
  throw new Error(`Failed to ${operation}: ${error.message ?? 'unknown Supabase error'}`);
}

function assertNonEmpty(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function normalizeOptionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeTimestamp(value?: Date | string): string {
  return value instanceof Date ? value.toISOString() : (value ?? new Date().toISOString());
}

export function mapIntroductionRow(row: IntroductionRow): Introduction {
  return {
    id: row.id,
    matchId: row.match_id,
    requesterIdentityId: row.requester_identity_id,
    helperIdentityId: row.helper_identity_id,
    stewardIdentityId: row.steward_identity_id,
    status: row.status,
    stewardNote: row.steward_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at,
  };
}

export async function createIntroduction(
  input: CreateIntroductionInput,
  client?: IntroductionRepositoryClient,
): Promise<Introduction> {
  const now = normalizeTimestamp(input.now);
  const { data, error } = await getIntroductionRepositoryClient(client)
    .from('introductions')
    .insert({
      match_id: assertNonEmpty(input.matchId, 'Approved match id'),
      requester_identity_id: assertNonEmpty(input.requesterIdentityId, 'Requester identity id'),
      helper_identity_id: assertNonEmpty(input.helperIdentityId, 'Helper identity id'),
      steward_identity_id: assertNonEmpty(input.stewardIdentityId, 'Steward identity id'),
      status: 'created',
      steward_note: normalizeOptionalText(input.stewardNote),
      created_at: now,
      updated_at: now,
      sent_at: null,
    })
    .select('*')
    .single();

  if (error) {
    throwIntroductionRepositoryError('create introduction', error);
  }

  return mapIntroductionRow(data);
}

export async function getIntroductionById(
  introductionId: string,
  client?: IntroductionRepositoryClient,
): Promise<Introduction | null> {
  const { data, error } = await getIntroductionRepositoryClient(client)
    .from('introductions')
    .select('*')
    .eq('id', assertNonEmpty(introductionId, 'Introduction id'))
    .maybeSingle();

  if (error) {
    throwIntroductionRepositoryError('get introduction by id', error);
  }

  return data ? mapIntroductionRow(data) : null;
}

export async function markIntroductionSent(
  introductionId: string,
  client?: IntroductionRepositoryClient,
  sentAt: Date | string = new Date(),
): Promise<Introduction> {
  const now = normalizeTimestamp(sentAt);
  const { data, error } = await getIntroductionRepositoryClient(client)
    .from('introductions')
    .update({ status: 'sent', sent_at: now, updated_at: now })
    .eq('id', assertNonEmpty(introductionId, 'Introduction id'))
    .select('*')
    .single();

  if (error) {
    throwIntroductionRepositoryError('mark introduction sent', error);
  }

  return mapIntroductionRow(data);
}
