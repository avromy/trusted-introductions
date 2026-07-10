import { createClient } from '@/lib/supabase/server';
import type { CapturedIntroductionOutcome } from '@/lib/introductions/outcomes';

type OutcomeRow = {
  id: string;
  introduction_id: string;
  reporter_identity_id: string;
  outcome: CapturedIntroductionOutcome['outcome'];
  private_note: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

type QueryResult<T> = Promise<{ data: T; error: { message?: string } | Error | null }>;
type Builder<T> = {
  insert(payload: unknown): Builder<T>;
  select(columns?: string): Builder<T>;
  eq(column: string, value: unknown): Builder<T>;
  order(column: string, options?: { ascending?: boolean }): Builder<T>;
  single(): QueryResult<T>;
  then<TResult1 = { data: T[]; error: { message?: string } | Error | null }>(
    onfulfilled?: ((value: { data: T[]; error: { message?: string } | Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
  ): Promise<TResult1>;
};

export type OutcomeRepositoryClient = {
  from(table: 'introduction_outcomes'): Builder<OutcomeRow>;
};

function client(override?: OutcomeRepositoryClient): OutcomeRepositoryClient {
  return override ?? (createClient() as unknown as OutcomeRepositoryClient);
}

function fail(operation: string, error: { message?: string } | Error): never {
  throw new Error(`Failed to ${operation}: ${error.message ?? 'unknown Supabase error'}`);
}

export async function createIntroductionOutcome(
  outcome: CapturedIntroductionOutcome,
  override?: OutcomeRepositoryClient,
): Promise<OutcomeRow> {
  const { data, error } = await client(override)
    .from('introduction_outcomes')
    .insert({
      introduction_id: outcome.introductionId,
      reporter_identity_id: outcome.reporterIdentityId,
      outcome: outcome.outcome,
      private_note: outcome.note,
      occurred_at: outcome.capturedAt,
    })
    .select('*')
    .single();

  if (error) fail('create introduction outcome', error);
  return data;
}

export async function listOutcomesForIntroduction(
  introductionId: string,
  override?: OutcomeRepositoryClient,
): Promise<OutcomeRow[]> {
  const { data, error } = await client(override)
    .from('introduction_outcomes')
    .select('*')
    .eq('introduction_id', introductionId.trim())
    .order('occurred_at', { ascending: false });

  if (error) fail('list introduction outcomes', error);
  return data ?? [];
}
