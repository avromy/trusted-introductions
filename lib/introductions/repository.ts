import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/supabase';

export type IntroductionRow = Database['public']['Tables']['introductions']['Row'];

export interface Introduction {
  id: string;
  requestId: string;
  matchId: string;
  stewardReviewId: string;
  requesterIdentityId: string;
  helperIdentityId: string;
  createdByIdentityId: string;
  status: IntroductionRow['status'];
  context: Json;
  createdAt: string;
  updatedAt: string;
}

const SENSITIVE_INTRODUCTION_CONTEXT_KEYS = new Set([
  'message',
  'messageContent',
  'message_content',
  'rawIntroductionMessage',
  'raw_introduction_message',
]);

export interface CreateIntroductionInput {
  requestId: string;
  matchId: string;
  stewardReviewId: string;
  requesterIdentityId: string;
  helperIdentityId: string;
  createdByIdentityId: string;
  status?: IntroductionRow['status'];
  context?: Json;
}

type QueryResult<T> = Promise<{ data: T; error: { message?: string } | Error | null }>;

type IntroductionQueryBuilder<T> = {
  select(columns?: string): IntroductionQueryBuilder<T>;
  insert(payload: unknown): IntroductionQueryBuilder<T>;
  eq(column: string, value: unknown): IntroductionQueryBuilder<T>;
  single(): QueryResult<T>;
  maybeSingle(): QueryResult<T | null>;
};

export type IntroductionRepositoryClient = {
  from(table: 'introductions'): IntroductionQueryBuilder<IntroductionRow>;
};

function getIntroductionRepositoryClient(client?: IntroductionRepositoryClient): IntroductionRepositoryClient {
  return client ?? (createClient() as unknown as IntroductionRepositoryClient);
}

function throwIntroductionRepositoryError(operation: string, error: { message?: string } | Error): never {
  throw new Error(`Failed to ${operation}: ${error.message ?? 'unknown Supabase error'}`);
}

function isJsonRecord(value: Json): value is Record<string, Json> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function sanitizeIntroductionContextValue(value: Json): Json {
  if (Array.isArray(value)) return value.map(sanitizeIntroductionContextValue);
  if (!isJsonRecord(value)) return value;
  return Object.entries(value).reduce<Record<string, Json>>((safe, [key, entry]) => {
    if (!SENSITIVE_INTRODUCTION_CONTEXT_KEYS.has(key)) {
      safe[key] = sanitizeIntroductionContextValue(entry);
    }
    return safe;
  }, {});
}

export function sanitizeIntroductionContext(context: Json | undefined): Json {
  return sanitizeIntroductionContextValue(context ?? {});
}

export function mapIntroductionRow(row: IntroductionRow): Introduction {
  return {
    id: row.id,
    requestId: row.request_id,
    matchId: row.match_id,
    stewardReviewId: row.steward_review_id,
    requesterIdentityId: row.requester_identity_id,
    helperIdentityId: row.helper_identity_id,
    createdByIdentityId: row.created_by_identity_id,
    status: row.status,
    context: sanitizeIntroductionContext(row.context),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeCreateIntroductionInput(input: CreateIntroductionInput): Omit<IntroductionRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    request_id: input.requestId.trim(),
    match_id: input.matchId.trim(),
    steward_review_id: input.stewardReviewId.trim(),
    requester_identity_id: input.requesterIdentityId.trim(),
    helper_identity_id: input.helperIdentityId.trim(),
    created_by_identity_id: input.createdByIdentityId.trim(),
    status: input.status ?? 'draft',
    context: sanitizeIntroductionContext(input.context),
  };
}

export async function createIntroduction(
  input: CreateIntroductionInput,
  client?: IntroductionRepositoryClient,
): Promise<Introduction> {
  const { data, error } = await getIntroductionRepositoryClient(client)
    .from('introductions')
    .insert(normalizeCreateIntroductionInput(input))
    .select('*')
    .single();

  if (error) throwIntroductionRepositoryError('create introduction', error);
  return mapIntroductionRow(data);
}

export async function getIntroductionById(
  introductionId: string,
  client?: IntroductionRepositoryClient,
): Promise<Introduction | null> {
  const { data, error } = await getIntroductionRepositoryClient(client)
    .from('introductions')
    .select('*')
    .eq('id', introductionId.trim())
    .maybeSingle();

  if (error) throwIntroductionRepositoryError('get introduction by id', error);
  return data ? mapIntroductionRow(data) : null;
}
