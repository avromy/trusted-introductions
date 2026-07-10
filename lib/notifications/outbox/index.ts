import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/supabase';

export type NotificationOutboxRow = Database['public']['Tables']['notification_outbox']['Row'];
export type NotificationOutboxChannel = Database['public']['Enums']['notification_outbox_channel'];
export type NotificationOutboxStatus = Database['public']['Enums']['notification_outbox_status'];
export type NotificationFailureClassification = Database['public']['Enums']['notification_failure_classification'];

export type NotificationOutboxRecord = {
  id: string;
  category: string;
  recipientIdentityId: string | null;
  channel: NotificationOutboxChannel;
  destinationRef: string;
  templatePayload: Json;
  metadata: Json;
  idempotencyKey: string;
  status: NotificationOutboxStatus;
  attemptCount: number;
  nextAttemptAt: string;
  sentAt: string | null;
  failureClassification: NotificationFailureClassification | null;
  createdAt: string;
  updatedAt: string;
};

export type EnqueueNotificationOutboxInput = {
  category: string;
  recipientIdentityId?: string | null;
  channel: NotificationOutboxChannel;
  destinationRef: string;
  templatePayload?: Json;
  metadata?: Json;
  idempotencyKey: string;
  nextAttemptAt?: string | Date;
};

type QueryResult<T> = Promise<{ data: T; error: { message?: string; code?: string } | Error | null }>;

type NotificationOutboxQueryBuilder<T> = {
  select(columns?: string): any;
  insert(payload: unknown): NotificationOutboxQueryBuilder<T>;
  update(payload: unknown): NotificationOutboxQueryBuilder<T>;
  eq(column: string, value: unknown): NotificationOutboxQueryBuilder<T>;
  in(column: string, values: unknown[]): NotificationOutboxQueryBuilder<T>;
  lte(column: string, value: unknown): NotificationOutboxQueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): NotificationOutboxQueryBuilder<T>;
  limit(count: number): NotificationOutboxQueryBuilder<T>;
  single(): QueryResult<T>;
  maybeSingle(): QueryResult<T | null>;
};

export type NotificationOutboxRepositoryClient = {
  from(table: 'notification_outbox'): NotificationOutboxQueryBuilder<NotificationOutboxRow>;
};

function getClient(client?: NotificationOutboxRepositoryClient): NotificationOutboxRepositoryClient {
  return client ?? (createClient() as unknown as NotificationOutboxRepositoryClient);
}

function throwOutboxError(operation: string, error: { message?: string } | Error): never {
  throw new Error(`Failed to ${operation}: ${error.message ?? 'unknown Supabase error'}`);
}

function normalizeJsonObject(value: Json | undefined, fallback: Record<string, never> = {}): Json {
  return value === undefined || value === null ? fallback : value;
}

export function normalizeOutboxInput(input: EnqueueNotificationOutboxInput): Omit<NotificationOutboxRow, 'id' | 'status' | 'attempt_count' | 'sent_at' | 'failure_classification' | 'created_at' | 'updated_at'> {
  const category = input.category.trim();
  const destinationRef = input.destinationRef.trim();
  const idempotencyKey = input.idempotencyKey.trim();

  if (!category) throw new Error('Notification category is required.');
  if (!destinationRef) throw new Error('Notification destination reference is required.');
  if (!idempotencyKey) throw new Error('Notification idempotency key is required.');

  return {
    category,
    recipient_identity_id: input.recipientIdentityId?.trim() || null,
    channel: input.channel,
    destination_ref: destinationRef,
    template_payload: normalizeJsonObject(input.templatePayload),
    metadata: normalizeJsonObject(input.metadata),
    idempotency_key: idempotencyKey,
    next_attempt_at: input.nextAttemptAt instanceof Date ? input.nextAttemptAt.toISOString() : (input.nextAttemptAt ?? new Date().toISOString()),
  };
}

export function mapOutboxRow(row: NotificationOutboxRow): NotificationOutboxRecord {
  return {
    id: row.id,
    category: row.category,
    recipientIdentityId: row.recipient_identity_id,
    channel: row.channel,
    destinationRef: row.destination_ref,
    templatePayload: row.template_payload,
    metadata: row.metadata,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    attemptCount: row.attempt_count,
    nextAttemptAt: row.next_attempt_at,
    sentAt: row.sent_at,
    failureClassification: row.failure_classification,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function enqueueNotification(input: EnqueueNotificationOutboxInput, client?: NotificationOutboxRepositoryClient): Promise<NotificationOutboxRecord> {
  const { data, error } = await getClient(client).from('notification_outbox').insert(normalizeOutboxInput(input)).select('*').single();
  if (error) throwOutboxError('enqueue notification', error);
  return mapOutboxRow(data);
}

export async function getNotificationById(id: string, client?: NotificationOutboxRepositoryClient): Promise<NotificationOutboxRecord | null> {
  const { data, error } = await getClient(client).from('notification_outbox').select('*').eq('id', id.trim()).maybeSingle();
  if (error) throwOutboxError('lookup notification by id', error);
  return data ? mapOutboxRow(data) : null;
}

export async function getNotificationByIdempotencyKey(idempotencyKey: string, client?: NotificationOutboxRepositoryClient): Promise<NotificationOutboxRecord | null> {
  const { data, error } = await getClient(client).from('notification_outbox').select('*').eq('idempotency_key', idempotencyKey.trim()).maybeSingle();
  if (error) throwOutboxError('lookup notification by idempotency key', error);
  return data ? mapOutboxRow(data) : null;
}

export async function claimPendingNotifications(limit: number, now: Date = new Date(), client?: NotificationOutboxRepositoryClient): Promise<NotificationOutboxRecord[]> {
  const { data, error } = await getClient(client)
    .from('notification_outbox')
    .update({ status: 'processing', attempt_count: 1 })
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', now.toISOString())
    .select('*')
    .order('next_attempt_at', { ascending: true })
    .limit(limit);
  if (error) throwOutboxError('claim pending notifications', error);
  return ((data as unknown as NotificationOutboxRow[]) ?? []).map(mapOutboxRow);
}

export async function markNotificationSent(id: string, sentAt: Date = new Date(), client?: NotificationOutboxRepositoryClient): Promise<NotificationOutboxRecord> {
  const { data, error } = await getClient(client).from('notification_outbox').update({ status: 'sent', sent_at: sentAt.toISOString(), failure_classification: null }).eq('id', id.trim()).select('*').single();
  if (error) throwOutboxError('mark notification sent', error);
  return mapOutboxRow(data);
}

export async function markNotificationFailed(id: string, failureClassification: NotificationFailureClassification, nextAttemptAt: Date, client?: NotificationOutboxRepositoryClient): Promise<NotificationOutboxRecord> {
  const { data, error } = await getClient(client).from('notification_outbox').update({ status: 'failed', failure_classification: failureClassification, next_attempt_at: nextAttemptAt.toISOString() }).eq('id', id.trim()).select('*').single();
  if (error) throwOutboxError('mark notification failed', error);
  return mapOutboxRow(data);
}
