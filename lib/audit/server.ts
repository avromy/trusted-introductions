import type { AuditEventPayload } from '@/types/audit';

type AuditEventsInsertResult = {
  error: Error | null;
};

export type AuditEventsSupabaseClient = {
  from(table: 'audit_events'): {
    insert(payload: AuditEventPayload): Promise<AuditEventsInsertResult>;
  };
};

export async function insertAuditEvent(
  supabase: AuditEventsSupabaseClient,
  payload: AuditEventPayload,
): Promise<void> {
  const { error } = await supabase.from('audit_events').insert(payload);

  if (error) {
    throw error;
  }
}
