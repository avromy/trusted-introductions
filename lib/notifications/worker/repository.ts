import { createClient } from '@/lib/supabase/server';
import type { ClaimedNotificationOutboxRecord, NotificationFailureCategory, NotificationOutboxRecord, NotificationOutboxStore } from './types';

type SupabaseError = { message?: string } | null;
type QueryResult<T> = PromiseLike<{ data: T; error: SupabaseError }>;

type QueryBuilder<T> = {
  select(columns?: string): QueryBuilder<T>;
  update(payload: unknown): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;
  in(column: string, values: unknown[]): QueryBuilder<T>;
  or(filter: string): QueryBuilder<T>;
  lte(column: string, value: string): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  then<TResult1 = { data: T; error: SupabaseError }, TResult2 = never>(
    onfulfilled?: ((value: { data: T; error: SupabaseError }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
};

export type NotificationOutboxSupabaseClient = {
  from(table: 'notification_outbox'): QueryBuilder<NotificationOutboxRecord[] | ClaimedNotificationOutboxRecord[] | null>;
};

const OUTBOX_COLUMNS =
  'id, status, channel, provider, destination, payload, attempts, max_attempts, locked_by, locked_at, last_error_category, last_error_code, next_attempt_at';

export class SupabaseNotificationOutboxStore implements NotificationOutboxStore {
  constructor(private readonly client: NotificationOutboxSupabaseClient = createClient() as unknown as NotificationOutboxSupabaseClient) {}

  async claimPendingBatch(input: { limit: number; workerId: string; now: Date }): Promise<ClaimedNotificationOutboxRecord[]> {
    const nowIso = input.now.toISOString();
    const candidates = await this.client
      .from('notification_outbox')
      .select(OUTBOX_COLUMNS)
      .eq('status', 'pending')
      .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
      .order('created_at', { ascending: true })
      .limit(input.limit) as { data: NotificationOutboxRecord[] | null; error: SupabaseError };

    throwIfError('claim notification outbox candidates', candidates.error);
    const ids = (candidates.data ?? []).map((record) => record.id);
    if (ids.length === 0) return [];

    const claimed = await this.client
      .from('notification_outbox')
      .update({ status: 'processing', locked_by: input.workerId, locked_at: nowIso, updated_at: nowIso })
      .in('id', ids)
      .eq('status', 'pending')
      .select(OUTBOX_COLUMNS) as { data: ClaimedNotificationOutboxRecord[] | null; error: SupabaseError };

    throwIfError('claim notification outbox records', claimed.error);
    return claimed.data ?? [];
  }

  async markSent(input: { id: string; workerId: string; now: Date; providerMessageId?: string }): Promise<boolean> {
    const result = await this.client
      .from('notification_outbox')
      .update({ status: 'sent', sent_at: input.now.toISOString(), provider_message_id: input.providerMessageId ?? null, locked_by: null, locked_at: null, updated_at: input.now.toISOString() })
      .eq('id', input.id)
      .eq('status', 'processing')
      .eq('locked_by', input.workerId)
      .select('id') as { data: NotificationOutboxRecord[] | null; error: SupabaseError };
    throwIfError('mark notification sent', result.error);
    return (result.data ?? []).length === 1;
  }

  async markFailed(input: { id: string; workerId: string; now: Date; attempts: number; category: NotificationFailureCategory; code: string; nextAttemptAt: Date | null }): Promise<boolean> {
    const terminal = input.category === 'permanent';
    const result = await this.client
      .from('notification_outbox')
      .update({ status: terminal ? 'failed' : 'pending', attempts: input.attempts, last_error_category: input.category, last_error_code: input.code, next_attempt_at: input.nextAttemptAt?.toISOString() ?? null, locked_by: null, locked_at: null, updated_at: input.now.toISOString() })
      .eq('id', input.id)
      .eq('status', 'processing')
      .eq('locked_by', input.workerId)
      .select('id') as { data: NotificationOutboxRecord[] | null; error: SupabaseError };
    throwIfError('mark notification failed', result.error);
    return (result.data ?? []).length === 1;
  }
}

function throwIfError(operation: string, error: SupabaseError): void {
  if (error) throw new Error(`Failed to ${operation}: ${error.message ?? 'unknown Supabase error'}`);
}
