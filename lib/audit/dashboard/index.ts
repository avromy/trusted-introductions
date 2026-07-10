import { AUDIT_ACTOR_TYPES, AUDIT_EVENT_TYPES, type AuditActorType, type AuditEventType } from '@/types/audit';
import type { Database, Json } from '@/types/supabase';

export const AUDIT_DASHBOARD_DEFAULT_DAYS = 30;
export const AUDIT_DASHBOARD_MAX_DAYS = 90;
export const AUDIT_DASHBOARD_DEFAULT_PAGE_SIZE = 25;
export const AUDIT_DASHBOARD_MAX_PAGE_SIZE = 50;

const SAFE_METADATA_DENYLIST = [
  'contact', 'email', 'phone', 'resume', 'note', 'notes', 'message', 'body', 'secret', 'token', 'raw', 'form',
] as const;

export type AuditDashboardRow = Database['public']['Tables']['audit_events']['Row'];

export type AuditDashboardEvent = {
  id: string;
  eventType: string;
  actorType: AuditActorType | 'identity' | 'unknown';
  actorId: string | null;
  targetType: string;
  targetId: string | null;
  communityId: string | null;
  occurredAt: string;
  metadata: Record<string, Json>;
};

export type AuditDashboardFilters = {
  eventType?: string;
  actorType?: string;
  targetType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  now?: Date;
};

export type NormalizedAuditDashboardFilters = Required<Pick<AuditDashboardFilters, 'page' | 'pageSize'>> & {
  eventType: string | null;
  actorType: string | null;
  targetType: string | null;
  startDate: string;
  endDate: string;
};

export type AuditDashboardPage = {
  events: AuditDashboardEvent[];
  filters: NormalizedAuditDashboardFilters;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type AuditDashboardQueryResult = { data: AuditDashboardRow[] | null; error: Error | null; count?: number | null };
type AuditDashboardQuery = {
  select(columns: string, options?: { count?: 'exact' }): AuditDashboardQuery;
  order(column: string, options: { ascending: boolean }): AuditDashboardQuery;
  eq(column: string, value: string): AuditDashboardQuery;
  gte(column: string, value: string): AuditDashboardQuery;
  lte(column: string, value: string): AuditDashboardQuery;
  range(from: number, to: number): Promise<AuditDashboardQueryResult>;
};

export type AuditDashboardClient = { from(table: 'audit_events'): AuditDashboardQuery };

function isoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function clampDateRange(start: Date, end: Date, now: Date): { start: Date; end: Date } {
  const latestEnd = end > now ? now : end;
  const earliestStart = new Date(latestEnd);
  earliestStart.setUTCDate(earliestStart.getUTCDate() - AUDIT_DASHBOARD_MAX_DAYS);
  const boundedStart = start < earliestStart ? earliestStart : start;
  return boundedStart > latestEnd ? { start: earliestStart, end: latestEnd } : { start: boundedStart, end: latestEnd };
}

export function normalizeAuditDashboardFilters(input: AuditDashboardFilters = {}): NormalizedAuditDashboardFilters {
  const now = input.now ?? new Date();
  const defaultStart = new Date(now);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - AUDIT_DASHBOARD_DEFAULT_DAYS);
  const parsedStart = parseDate(input.startDate, defaultStart);
  const parsedEnd = parseDate(input.endDate, now);
  parsedEnd.setUTCHours(23, 59, 59, 999);
  const { start, end } = clampDateRange(parsedStart, parsedEnd, now);
  const pageSize = Math.min(Math.max(Number(input.pageSize) || AUDIT_DASHBOARD_DEFAULT_PAGE_SIZE, 1), AUDIT_DASHBOARD_MAX_PAGE_SIZE);
  const page = Math.max(Number(input.page) || 1, 1);

  return {
    eventType: input.eventType && AUDIT_EVENT_TYPES.includes(input.eventType as AuditEventType) ? input.eventType : null,
    actorType: input.actorType && [...AUDIT_ACTOR_TYPES, 'identity'].includes(input.actorType) ? input.actorType : null,
    targetType: input.targetType?.trim() || null,
    startDate: isoDateOnly(start),
    endDate: isoDateOnly(end),
    page,
    pageSize,
  };
}

export function sanitizeAuditDashboardMetadata(metadata: Json): Record<string, Json> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return Object.entries(metadata).reduce<Record<string, Json>>((safe, [key, value]) => {
    const lower = key.toLowerCase();
    if (SAFE_METADATA_DENYLIST.some((blocked) => lower.includes(blocked))) return safe;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) safe[key] = value as Json;
    return safe;
  }, {});
}

export function mapAuditDashboardEvent(row: AuditDashboardRow): AuditDashboardEvent {
  return {
    id: row.id,
    eventType: row.event_type,
    actorType: 'identity',
    actorId: row.actor_identity_id,
    targetType: row.subject_table,
    targetId: row.subject_id,
    communityId: row.community_id,
    occurredAt: row.created_at,
    metadata: sanitizeAuditDashboardMetadata(row.metadata),
  };
}

export async function listAuditDashboardEvents(client: AuditDashboardClient, input: AuditDashboardFilters = {}): Promise<AuditDashboardPage> {
  const filters = normalizeAuditDashboardFilters(input);
  const from = (filters.page - 1) * filters.pageSize;
  let query = client.from('audit_events').select('id,event_type,actor_identity_id,community_id,subject_table,subject_id,metadata,created_at', { count: 'exact' }).gte('created_at', `${filters.startDate}T00:00:00.000Z`).lte('created_at', `${filters.endDate}T23:59:59.999Z`);
  if (filters.eventType) query = query.eq('event_type', filters.eventType);
  if (filters.targetType) query = query.eq('subject_table', filters.targetType);
  // Current persisted audit rows are identity-actor rows. Keep actor filter explicit for forward compatibility.
  if (filters.actorType && filters.actorType !== 'identity') query = query.eq('actor_type', filters.actorType);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + filters.pageSize - 1);
  if (error) throw error;
  const totalCount = count ?? data?.length ?? 0;
  const totalPages = Math.max(Math.ceil(totalCount / filters.pageSize), 1);
  return { events: (data ?? []).map(mapAuditDashboardEvent), filters, totalCount, totalPages, hasNextPage: filters.page < totalPages, hasPreviousPage: filters.page > 1 };
}
