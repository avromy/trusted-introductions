import { createClient } from '@/lib/supabase/server';
import type { RankedHelperCandidate } from '@/lib/matching/engine';
import type {
  MatchSuggestion,
  MatchSuggestionExplanation,
  MatchSuggestionStatus,
} from '@/types/matching';
import type { Database, Json } from '@/types/supabase';

export type MatchSuggestionRow = Database['public']['Tables']['match_suggestions']['Row'];

type QueryResult<T> = Promise<{ data: T; error: { message?: string } | Error | null }>;

type MatchSuggestionQueryBuilder<T> = {
  select(columns?: string): MatchSuggestionQueryBuilder<T>;
  insert(payload: unknown): MatchSuggestionQueryBuilder<T>;
  delete(): MatchSuggestionQueryBuilder<T>;
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

function isExplanation(value: Json): value is Json & MatchSuggestionExplanation {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value.score === 'number' &&
    Array.isArray(value.reasons) &&
    value.reasons.every((reason) => typeof reason === 'string')
  );
}

export function mapMatchSuggestionRow(row: MatchSuggestionRow): MatchSuggestion {
  const explanation = isExplanation(row.explanation)
    ? row.explanation
    : { score: row.score, reasons: ['No persisted explanation found.'] };

  return {
    id: row.id,
    requestId: row.request_id,
    helperIdentityId: row.helper_identity_id,
    score: row.score,
    explanation,
    status: row.status,
    recalculatedByIdentityId: row.recalculated_by_identity_id,
    recalculatedAt: row.recalculated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listMatchSuggestionsForRequest(
  requestId: string,
  client?: MatchSuggestionRepositoryClient,
): Promise<MatchSuggestion[]> {
  const { data, error } = await getMatchSuggestionRepositoryClient(client)
    .from('match_suggestions')
    .select('*')
    .eq('request_id', requestId)
    .order('score', { ascending: false });

  if (error) {
    throwMatchSuggestionRepositoryError('list match suggestions for request', error);
  }

  return (data ?? []).map(mapMatchSuggestionRow);
}

export async function replaceMatchSuggestionsForRequest(
  input: {
    requestId: string;
    suggestions: readonly RankedHelperCandidate[];
    recalculatedByIdentityId: string;
    recalculatedAt?: Date | string;
    status?: MatchSuggestionStatus;
  },
  client?: MatchSuggestionRepositoryClient,
): Promise<MatchSuggestion[]> {
  const repositoryClient = getMatchSuggestionRepositoryClient(client);
  const recalculatedAt =
    input.recalculatedAt instanceof Date
      ? input.recalculatedAt.toISOString()
      : (input.recalculatedAt ?? new Date().toISOString());

  const deleteResult = await repositoryClient
    .from('match_suggestions')
    .delete()
    .eq('request_id', input.requestId)
    .order('score', { ascending: false });

  if (deleteResult.error) {
    throwMatchSuggestionRepositoryError('clear match suggestions for request', deleteResult.error);
  }

  if (input.suggestions.length === 0) {
    return [];
  }

  const payload = input.suggestions.map((suggestion) => ({
    request_id: input.requestId,
    helper_identity_id: suggestion.id,
    score: suggestion.matchScore,
    explanation: suggestion.matchExplanation,
    status: input.status ?? 'suggested',
    recalculated_by_identity_id: input.recalculatedByIdentityId,
    recalculated_at: recalculatedAt,
  }));

  const { data, error } = await repositoryClient
    .from('match_suggestions')
    .insert(payload)
    .select('*')
    .order('score', { ascending: false });

  if (error) {
    throwMatchSuggestionRepositoryError('persist match suggestions for request', error);
  }

  return (data ?? []).map(mapMatchSuggestionRow);
}
