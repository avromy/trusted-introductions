import { createClient } from '@/lib/supabase/server';
import type { StewardReview, StewardReviewInput } from '@/types/matching';
import type { Database } from '@/types/supabase';

export type StewardReviewRow = Database['public']['Tables']['steward_reviews']['Row'];

type QueryResult<T> = Promise<{ data: T; error: { message?: string } | Error | null }>;

type StewardReviewQueryBuilder<T> = {
  select(columns?: string): StewardReviewQueryBuilder<T>;
  insert(payload: unknown): StewardReviewQueryBuilder<T>;
  update(payload: unknown): StewardReviewQueryBuilder<T>;
  eq(column: string, value: unknown): StewardReviewQueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): StewardReviewQueryBuilder<T>;
  single(): QueryResult<T>;
  maybeSingle(): QueryResult<T | null>;
  then<TResult1 = { data: T[]; error: { message?: string } | Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[]; error: { message?: string } | Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
};

export type StewardReviewRepositoryClient = {
  from(table: 'steward_reviews'): StewardReviewQueryBuilder<StewardReviewRow>;
};

function getStewardReviewRepositoryClient(client?: StewardReviewRepositoryClient): StewardReviewRepositoryClient {
  return client ?? (createClient() as unknown as StewardReviewRepositoryClient);
}

function throwStewardReviewRepositoryError(operation: string, error: { message?: string } | Error): never {
  throw new Error(`Failed to ${operation}: ${error.message ?? 'unknown Supabase error'}`);
}

export function mapStewardReviewRow(row: StewardReviewRow): StewardReview {
  return {
    id: row.id,
    requestId: row.request_id,
    stewardIdentityId: row.steward_identity_id,
    subjectIdentityId: row.subject_identity_id,
    matchSuggestionId: row.match_suggestion_id,
    status: row.status,
    decisionReason: row.decision_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    decidedAt: row.decided_at,
  };
}

function normalizeStewardReviewInput(review: StewardReviewInput): Omit<StewardReviewRow, 'id' | 'created_at' | 'updated_at' | 'decided_at'> {
  return {
    request_id: review.requestId.trim(),
    steward_identity_id: review.stewardIdentityId.trim(),
    subject_identity_id: review.subjectIdentityId.trim(),
    match_suggestion_id: review.matchSuggestionId?.trim() || null,
    status: review.status ?? 'pending',
    decision_reason: review.decisionReason?.trim() || null,
  };
}

export async function createStewardReview(
  review: StewardReviewInput,
  client?: StewardReviewRepositoryClient,
): Promise<StewardReview> {
  const { data, error } = await getStewardReviewRepositoryClient(client)
    .from('steward_reviews')
    .insert(normalizeStewardReviewInput(review))
    .select('*')
    .single();

  if (error) {
    throwStewardReviewRepositoryError('create steward review', error);
  }

  return mapStewardReviewRow(data);
}

export async function getStewardReviewById(
  reviewId: string,
  client?: StewardReviewRepositoryClient,
): Promise<StewardReview | null> {
  const { data, error } = await getStewardReviewRepositoryClient(client)
    .from('steward_reviews')
    .select('*')
    .eq('id', reviewId.trim())
    .maybeSingle();

  if (error) {
    throwStewardReviewRepositoryError('get steward review by id', error);
  }

  return data ? mapStewardReviewRow(data) : null;
}

export async function listStewardReviewsForRequest(
  requestId: string,
  client?: StewardReviewRepositoryClient,
): Promise<StewardReview[]> {
  const { data, error } = await getStewardReviewRepositoryClient(client)
    .from('steward_reviews')
    .select('*')
    .eq('request_id', requestId.trim())
    .order('created_at', { ascending: false });

  if (error) {
    throwStewardReviewRepositoryError('list steward reviews for request', error);
  }

  return (data ?? []).map(mapStewardReviewRow);
}

export async function updateStewardReviewDecision(
  review: Pick<StewardReview, 'id' | 'status' | 'decisionReason'>,
  decidedAt: Date,
  client?: StewardReviewRepositoryClient,
): Promise<StewardReview> {
  const { data, error } = await getStewardReviewRepositoryClient(client)
    .from('steward_reviews')
    .update({
      status: review.status,
      decision_reason: review.decisionReason?.trim() || null,
      decided_at: decidedAt.toISOString(),
    })
    .eq('id', review.id.trim())
    .select('*')
    .single();

  if (error) {
    throwStewardReviewRepositoryError('update steward review decision', error);
  }

  return mapStewardReviewRow(data);
}
