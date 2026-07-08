import { createClient } from '@/lib/supabase/server';
import type { MatchSuggestion, MatchSuggestionInput } from '@/types/matching';
import type { Database, Json } from '@/types/supabase';

export type MatchSuggestionRow = Database['public']['Tables']['match_suggestions']['Row'];

type QueryResult<T> = Promise<{ data: T; error: { message?: string } | Error | null }>;

type MatchSuggestionDeleteBuilder = {
  eq(column: string, value: unknown): QueryResult<null>;
};

type MatchSuggestionQueryBuilder<T> = {
  select(columns?: string): MatchSuggestionQueryBuilder<T>;
  insert(payload: unknown): MatchSuggestionQueryBuilder<T>;
  delete(): MatchSuggestionDeleteBuilder;
  eq(column: string, value: unknown): MatchSuggestionQueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): QueryResult<T[]>;
};

export type MatchSuggestionRepositoryClient = {
  from(table: 'match_suggestions'): MatchSuggestionQueryBuilder<MatchSuggestionRow>;
};

function getMatchSuggestionRepositoryClient(
  client?: MatchSuggestionRepositoryClient,
): MatchSuggestionRepositoryClient {
  return client ?? (createClient() as unknown as MatchSuggestionRepositoryClient);
}

function throwMatchSuggestionRepositoryError(
  operation: string,
  error: { message?: string } | Error,
): never {
  throw new Error(`Failed to ${operation}: ${error.message ?? 'unknown Supabase error'}`);
}

export function mapMatchSuggestionRow(row: MatchSuggestionRow): MatchSuggestion {
  return {
    id: row.id,
    requestId: row.request_id,
    helperIdentityId: row.helper_identity_id,
    helperCapabilityId: row.helper_capability_id,
    rank: row.rank,
    score: row.score,
    reasons: row.reasons,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeMatchSuggestionInput(
  requestId: string,
  suggestion: MatchSuggestionInput,
): Omit<MatchSuggestionRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    request_id: requestId,
    helper_identity_id: suggestion.helperIdentityId.trim(),
    helper_capability_id: suggestion.helperCapabilityId.trim(),
    rank: suggestion.rank,
    score: suggestion.score,
    reasons: [...suggestion.reasons],
    metadata: suggestion.metadata ?? {},
  };
}

export async function listMatchSuggestionsForRequest(
  requestId: string,
  client?: MatchSuggestionRepositoryClient,
): Promise<MatchSuggestion[]> {
  const { data, error } = await getMatchSuggestionRepositoryClient(client)
    .from('match_suggestions')
    .select('*')
    .eq('request_id', requestId.trim())
    .order('rank', { ascending: true });

  if (error) {
    throwMatchSuggestionRepositoryError('list match suggestions for request', error);
  }

  return (data ?? []).map(mapMatchSuggestionRow);
}

export async function replaceMatchSuggestionsForRequest(
  requestId: string,
  suggestions: readonly MatchSuggestionInput[],
  client?: MatchSuggestionRepositoryClient,
): Promise<MatchSuggestion[]> {
  const supabase = getMatchSuggestionRepositoryClient(client);
  const normalizedRequestId = requestId.trim();

  const { error: deleteError } = await supabase
    .from('match_suggestions')
    .delete()
    .eq('request_id', normalizedRequestId);

  if (deleteError) {
    throwMatchSuggestionRepositoryError('replace stale match suggestions', deleteError);
  }

  if (suggestions.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('match_suggestions')
    .insert(suggestions.map((suggestion) => normalizeMatchSuggestionInput(normalizedRequestId, suggestion)))
    .select('*')
    .order('rank', { ascending: true });

  if (error) {
    throwMatchSuggestionRepositoryError('replace match suggestions for request', error);
  }

  return (data ?? []).map(mapMatchSuggestionRow);
}
