import { createClient } from '@/lib/supabase/server';
import type { CreatedIntroduction } from '@/lib/introductions/creation';
import type { Database } from '@/types/supabase';

export type IntroductionRow = Database['public']['Tables']['introductions']['Row'];

type QueryResult<T> = Promise<{ data: T; error: { message?: string } | Error | null }>;

type IntroductionQueryBuilder<T> = {
  insert(payload: unknown): IntroductionQueryBuilder<T>;
  select(columns?: string): IntroductionQueryBuilder<T>;
  single(): QueryResult<T>;
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

export function mapIntroductionRow(row: IntroductionRow): CreatedIntroduction & { id: string } {
  return {
    id: row.id,
    requestId: row.request_id,
    matchSuggestionId: row.match_suggestion_id,
    helperIdentityId: row.helper_identity_id,
    requesterIdentityId: row.requester_identity_id,
    stewardIdentityId: row.steward_identity_id,
    stewardReviewId: row.steward_review_id,
    status: row.status,
    message: row.message,
    createdAt: row.created_at,
  };
}

export async function insertIntroduction(
  introduction: CreatedIntroduction,
  client?: IntroductionRepositoryClient,
): Promise<CreatedIntroduction & { id: string }> {
  const { data, error } = await getIntroductionRepositoryClient(client)
    .from('introductions')
    .insert({
      request_id: introduction.requestId,
      match_suggestion_id: introduction.matchSuggestionId,
      helper_identity_id: introduction.helperIdentityId,
      requester_identity_id: introduction.requesterIdentityId,
      steward_identity_id: introduction.stewardIdentityId,
      steward_review_id: introduction.stewardReviewId,
      status: introduction.status,
      message: introduction.message,
    })
    .select('*')
    .single();

  if (error) {
    throwIntroductionRepositoryError('create introduction', error);
  }

  return mapIntroductionRow(data);
}
