import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/supabase';

export const INTRODUCTION_STATUSES = ['draft', 'ready_for_steward', 'sent', 'cancelled'] as const;
export type IntroductionStatus = (typeof INTRODUCTION_STATUSES)[number];

export type ApprovedMatchRow = {
  id: string;
  request_id: string;
  requester_identity_id: string;
  helper_identity_id: string;
  status: string;
  steward_identity_id?: string | null;
  steward_review_id?: string | null;
  match_score?: number | null;
  match_context?: Json | null;
  created_at?: string;
  updated_at?: string;
};

export type IntroductionRow = {
  id: string;
  request_id: string;
  match_id: string;
  requester_identity_id: string;
  helper_identity_id: string;
  steward_identity_id: string;
  status: IntroductionStatus;
  safe_context: Json;
  created_at: string;
  updated_at: string;
};

type QueryResult<T> = Promise<{ data: T | null; error: Error | null }>;

type QueryBuilder<T> = {
  select(columns: string): QueryBuilder<T>;
  insert(payload: unknown): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): QueryBuilder<T>;
  maybeSingle(): QueryResult<T>;
  single(): QueryResult<T>;
};

export type IntroductionRepositoryClient = {
  from(table: 'matches'): QueryBuilder<ApprovedMatchRow>;
  from(table: 'introductions'): QueryBuilder<IntroductionRow>;
  from(table: 'trusted_identities' | 'user_roles'): any;
};

export type SafeIntroductionContext = {
  request: {
    id: string;
    headline?: string | null;
    targetRole?: string | null;
    targetCompanies?: string[];
    targetLocations?: string[];
  };
  match: {
    id: string;
    score?: number | null;
    stewardReviewId?: string | null;
  };
  helper: {
    identityId: string;
  };
  requester: {
    identityId: string;
  };
  steward: {
    identityId: string;
  };
  guardrails: {
    personalEndorsement: false;
    emailNotificationSent: false;
  };
};

export type CreateIntroductionInput = {
  match: ApprovedMatchRow;
  stewardIdentityId: string;
  safeContext: SafeIntroductionContext;
  now?: Date;
};

function getClient(client?: IntroductionRepositoryClient): IntroductionRepositoryClient {
  return client ?? (createClient() as unknown as IntroductionRepositoryClient);
}

function throwRepositoryError(operation: string, error: Error): never {
  throw new Error(`Failed to ${operation}: ${error.message}`);
}

export async function getMatchById(
  matchId: string,
  client?: IntroductionRepositoryClient,
): Promise<ApprovedMatchRow | null> {
  const { data, error } = await getClient(client)
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
): Promise<IntroductionRow | null> {
  const { data, error } = await getClient(client)
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
): Promise<IntroductionRow> {
  const now = input.now ?? new Date();
  const { data, error } = await getClient(client)
    .from('introductions')
    .insert({
      request_id: input.match.request_id,
      match_id: input.match.id,
      requester_identity_id: input.match.requester_identity_id,
      helper_identity_id: input.match.helper_identity_id,
      steward_identity_id: input.stewardIdentityId,
      status: 'draft',
      safe_context: input.safeContext,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    throwRepositoryError('create introduction', error);
  }

  if (!data) {
    throw new Error('Introduction creation did not return a row.');
  }

  return data;
}
