import { requireStewardOrAdmin, toSafeAuthFailureResult } from '@/lib/auth/steward';
import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/supabase';

type RequestRow = Database['public']['Tables']['job_seeker_requests']['Row'];
type MatchRow = Database['public']['Tables']['match_suggestions']['Row'];
type ReviewRow = Database['public']['Tables']['steward_reviews']['Row'];
type IntroRow = Database['public']['Tables']['introductions']['Row'];
type AuditRow = Database['public']['Tables']['audit_events']['Row'];

type AnyBuilder<T> = {
  select(columns?: string): AnyBuilder<T>;
  order(column: string, options: { ascending: boolean }): AnyBuilder<T> | Promise<{ data: T[] | null; error: Error | { message?: string } | null }>;
  range(from: number, to: number): Promise<{ data: T[] | null; error: Error | { message?: string } | null }>;
};

export type StewardOperationsClient = Parameters<typeof requireStewardOrAdmin>[0] & {
  from(table: 'job_seeker_requests'): AnyBuilder<RequestRow>;
  from(table: 'match_suggestions'): AnyBuilder<MatchRow>;
  from(table: 'steward_reviews'): AnyBuilder<ReviewRow>;
  from(table: 'introductions'): AnyBuilder<IntroRow>;
  from(table: 'audit_events'): AnyBuilder<AuditRow>;
};

export type QueueKind =
  | 'requests_awaiting_match_review'
  | 'reviews_needing_information'
  | 'approved_matches_awaiting_introduction'
  | 'introductions_needing_follow_up'
  | 'introductions_awaiting_outcome';

export type QueueItem = {
  id: string;
  kind: QueueKind;
  title: string;
  subtitle: string;
  href: string;
  createdAt: string;
  status: string;
  relatedIds: Record<string, string>;
};

export type StewardOperationsQueue = {
  pagination: { limit: number; offset: number; returned: number; hasMore: boolean };
  counts: Record<QueueKind, number>;
  items: QueueItem[];
};

export type StewardOperationsQueueResult =
  | { ok: true; queue: StewardOperationsQueue }
  | { ok: false; state: 'unauthorized' | 'error'; message: string };

const KINDS: QueueKind[] = [
  'requests_awaiting_match_review',
  'reviews_needing_information',
  'approved_matches_awaiting_introduction',
  'introductions_needing_follow_up',
  'introductions_awaiting_outcome',
];
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

function bound(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

type OperationsTable = 'job_seeker_requests' | 'match_suggestions' | 'steward_reviews' | 'introductions' | 'audit_events';

async function listRows<T>(client: StewardOperationsClient, table: OperationsTable, limit: number): Promise<T[]> {
  const from = client.from as unknown as (table: OperationsTable) => AnyBuilder<T>;
  const result = await (from(table).select('*').order('created_at', { ascending: false }) as AnyBuilder<T>).range(0, limit - 1);
  if (result.error) throw new Error(result.error.message ?? `Failed to load ${table}`);
  return result.data ?? [];
}

function metadataOutcome(metadata: Json): string | null {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) && typeof metadata.outcome === 'string' ? metadata.outcome : null;
}

export function classifyStewardOperationsQueue(input: {
  requests: RequestRow[];
  matches: MatchRow[];
  reviews: ReviewRow[];
  introductions: IntroRow[];
  auditEvents: AuditRow[];
  limit?: number;
  offset?: number;
}): StewardOperationsQueue {
  const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = input.offset ?? 0;
  const matchesByRequest = new Map<string, MatchRow[]>();
  input.matches.forEach((match) => matchesByRequest.set(match.request_id, [...(matchesByRequest.get(match.request_id) ?? []), match]));
  const reviewsByMatch = new Map(input.reviews.filter((review) => review.match_suggestion_id).map((review) => [review.match_suggestion_id, review]));
  const introByReview = new Set(input.introductions.map((intro) => intro.steward_review_id));
  const followUpEvents = new Map<string, AuditRow[]>();
  const outcomeEvents = new Set<string>();
  input.auditEvents.forEach((event) => {
    if (event.subject_table !== 'introductions' || !event.subject_id) return;
    if (event.event_type.startsWith('introduction_follow_up_reminder.')) followUpEvents.set(event.subject_id, [...(followUpEvents.get(event.subject_id) ?? []), event]);
    if (event.event_type.startsWith('introduction_outcome.') && metadataOutcome(event.metadata)) outcomeEvents.add(event.subject_id);
  });
  const all: QueueItem[] = [];
  input.requests.filter((request) => ['open', 'matched'].includes(request.status)).forEach((request) => {
    const pendingMatches = (matchesByRequest.get(request.id) ?? []).filter((match) => !reviewsByMatch.has(match.id));
    if (pendingMatches.length > 0) all.push({ id: `request:${request.id}`, kind: 'requests_awaiting_match_review', title: request.headline, subtitle: `${pendingMatches.length} suggested match${pendingMatches.length === 1 ? '' : 'es'} need steward review`, href: `/steward/requests/${request.id}/matches`, createdAt: request.created_at, status: request.status, relatedIds: { requestId: request.id } });
  });
  input.reviews.filter((review) => review.status === 'needs_info').forEach((review) => all.push({ id: `review:${review.id}`, kind: 'reviews_needing_information', title: 'Review needs information', subtitle: `Request ${review.request_id}`, href: `/steward/requests/${review.request_id}/matches`, createdAt: review.updated_at, status: review.status, relatedIds: { requestId: review.request_id, reviewId: review.id } }));
  input.reviews.filter((review) => review.status === 'approved' && !introByReview.has(review.id)).forEach((review) => all.push({ id: `approved:${review.id}`, kind: 'approved_matches_awaiting_introduction', title: 'Approved match awaiting introduction', subtitle: `Subject ${review.subject_identity_id}`, href: `/steward/requests/${review.request_id}/matches`, createdAt: review.decided_at ?? review.updated_at, status: review.status, relatedIds: { requestId: review.request_id, reviewId: review.id } }));
  input.introductions.filter((intro) => intro.status === 'ready' && !(followUpEvents.get(intro.id) ?? []).some((event) => event.event_type === 'introduction_follow_up_reminder.scheduled')).forEach((intro) => all.push({ id: `follow-up:${intro.id}`, kind: 'introductions_needing_follow_up', title: 'Introduction needs follow-up', subtitle: `Request ${intro.request_id}`, href: `/introductions/${intro.id}/follow-up`, createdAt: intro.updated_at, status: intro.status, relatedIds: { introductionId: intro.id, requestId: intro.request_id } }));
  input.introductions.filter((intro) => intro.status === 'completed' && !outcomeEvents.has(intro.id)).forEach((intro) => all.push({ id: `outcome:${intro.id}`, kind: 'introductions_awaiting_outcome', title: 'Introduction awaiting outcome', subtitle: `Request ${intro.request_id}`, href: `/introductions/${intro.id}/outcome`, createdAt: intro.updated_at, status: intro.status, relatedIds: { introductionId: intro.id, requestId: intro.request_id } }));
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const counts = Object.fromEntries(KINDS.map((kind) => [kind, all.filter((item) => item.kind === kind).length])) as Record<QueueKind, number>;
  const page = all.slice(offset, offset + limit);
  return { pagination: { limit, offset, returned: page.length, hasMore: offset + limit < all.length }, counts, items: page };
}

export async function getStewardOperationsQueue(params: { limit?: string; offset?: string } = {}, client?: StewardOperationsClient): Promise<StewardOperationsQueueResult> {
  const supabase = client ?? (createClient() as unknown as StewardOperationsClient);
  try {
    await requireStewardOrAdmin(supabase);
  } catch (error) {
    const failure = toSafeAuthFailureResult(error);
    return { ok: false, state: 'unauthorized', message: failure.message };
  }
  const limit = bound(params.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const offset = bound(params.offset, 0, 5_000);
  try {
    const fetchLimit = Math.min(offset + limit + 1, 500);
    const [requests, matches, reviews, introductions, auditEvents] = await Promise.all([
      listRows<RequestRow>(supabase, 'job_seeker_requests', fetchLimit),
      listRows<MatchRow>(supabase, 'match_suggestions', fetchLimit),
      listRows<ReviewRow>(supabase, 'steward_reviews', fetchLimit),
      listRows<IntroRow>(supabase, 'introductions', fetchLimit),
      listRows<AuditRow>(supabase, 'audit_events', fetchLimit),
    ]);
    return { ok: true, queue: classifyStewardOperationsQueue({ requests, matches, reviews, introductions, auditEvents, limit, offset }) };
  } catch {
    return { ok: false, state: 'error', message: 'We could not load the steward operations queue.' };
  }
}
