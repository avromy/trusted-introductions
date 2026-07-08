import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/supabase';

export type MatchStatus = 'pending' | 'approved' | 'rejected' | 'needs_info';

export interface IntroductionMatch {
  id: string;
  request_id: string;
  requester_identity_id: string;
  helper_identity_id: string;
  status: MatchStatus;
  community_id?: string | null;
}

export interface Introduction {
  id: string;
  request_id: string;
  match_id: string;
  requester_identity_id: string;
  helper_identity_id: string;
  created_by_identity_id: string;
  context: Json;
  status: 'draft' | 'created';
  created_at: string;
}

export interface CreateIntroductionInput {
  match: IntroductionMatch;
  createdByIdentityId: string;
  context?: Json;
  now?: Date | string;
}

type QueryResult<T> = Promise<{ data: T; error: { message?: string } | Error | null }>;

type QueryBuilder<T> = {
  select(columns: string): QueryBuilder<T>;
  insert(payload: unknown): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;
  maybeSingle(): QueryResult<T | null>;
  single(): QueryResult<T>;
};

export type IntroductionRepositoryClient = {
  from(table: 'introductions'): QueryBuilder<Introduction>;
  from(table: 'matches'): QueryBuilder<IntroductionMatch>;
};

function getRepositoryClient(client?: IntroductionRepositoryClient): IntroductionRepositoryClient {
  return client ?? (createClient() as unknown as IntroductionRepositoryClient);
}

function throwRepositoryError(operation: string, error: { message?: string } | Error): never {
  throw new Error(`Failed to ${operation}: ${error.message ?? 'unknown Supabase error'}`);
}

function normalizeDate(value?: Date | string): string {
  return value instanceof Date ? value.toISOString() : (value ?? new Date().toISOString());
}

export function createSafeIntroductionContext(match: IntroductionMatch): Json {
  return {
    summary: 'A steward-approved introduction was created from an approved match.',
    safety: {
      aiGeneratedEndorsement: false,
      emailSent: false,
    },
    references: {
      requestId: match.request_id,
      matchId: match.id,
    },
  };
}

export async function getMatchById(
  matchId: string,
  client?: IntroductionRepositoryClient,
): Promise<IntroductionMatch | null> {
  const { data, error } = await getRepositoryClient(client)
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle();

  if (error) {
    throwRepositoryError('get match by id', error);
  }

  return data;
}

export async function getIntroductionById(
  introductionId: string,
  client?: IntroductionRepositoryClient,
): Promise<Introduction | null> {
  const { data, error } = await getRepositoryClient(client)
    .from('introductions')
    .select('*')
    .eq('id', introductionId)
    .maybeSingle();

  if (error) {
    throwRepositoryError('get introduction by id', error);
  }

  return data;
}

export async function createIntroduction(
  input: CreateIntroductionInput,
  client?: IntroductionRepositoryClient,
): Promise<Introduction> {
  const payload = {
    request_id: input.match.request_id,
    match_id: input.match.id,
    requester_identity_id: input.match.requester_identity_id,
    helper_identity_id: input.match.helper_identity_id,
    created_by_identity_id: input.createdByIdentityId,
    context: input.context ?? createSafeIntroductionContext(input.match),
    status: 'created' as const,
    created_at: normalizeDate(input.now),
  };

  const { data, error } = await getRepositoryClient(client)
    .from('introductions')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throwRepositoryError('create introduction', error);
  }

  return data;
}
