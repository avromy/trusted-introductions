import { createClient } from '@/lib/supabase/server';
import type { IntroductionFollowUpReminder } from '@/lib/introductions/follow-up-reminders';

type FollowUpRow = {
  id: string;
  introduction_id: string;
  created_by_identity_id: string;
  recipient_identity_ids: string[];
  remind_at: string;
  status: 'scheduled' | 'sent' | 'completed' | 'skipped' | 'canceled';
  private_note: string | null;
  completed_at: string | null;
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

export type FollowUpRepositoryClient = {
  from(table: 'introduction_follow_ups'): Builder<FollowUpRow>;
};

function client(override?: FollowUpRepositoryClient): FollowUpRepositoryClient {
  return override ?? (createClient() as unknown as FollowUpRepositoryClient);
}

function fail(operation: string, error: { message?: string } | Error): never {
  throw new Error(`Failed to ${operation}: ${error.message ?? 'unknown Supabase error'}`);
}

export async function createFollowUpReminder(
  reminder: IntroductionFollowUpReminder,
  override?: FollowUpRepositoryClient,
): Promise<FollowUpRow> {
  const { data, error } = await client(override)
    .from('introduction_follow_ups')
    .insert({
      introduction_id: reminder.introductionId,
      created_by_identity_id: reminder.stewardIdentityId,
      recipient_identity_ids: reminder.recipientIdentityIds,
      remind_at: reminder.remindAt,
      status: reminder.status,
      private_note: reminder.note,
      created_at: reminder.createdAt,
    })
    .select('*')
    .single();

  if (error) fail('create follow-up reminder', error);
  return data;
}

export async function listFollowUpsForIntroduction(
  introductionId: string,
  override?: FollowUpRepositoryClient,
): Promise<FollowUpRow[]> {
  const { data, error } = await client(override)
    .from('introduction_follow_ups')
    .select('*')
    .eq('introduction_id', introductionId.trim())
    .order('created_at', { ascending: false });

  if (error) fail('list follow-up reminders', error);
  return data ?? [];
}
