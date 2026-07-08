import type { MatchExplanation } from '@/lib/matching/engine';
import type { HelperAvailabilityStatus } from '@/lib/matching/helper-capability';
import type { JobSeekerRequest, JobSeekerRequestStatus } from '@/types/matching';
import type { Json } from '@/types/supabase';

export const MATCH_SUGGESTION_STATUS_VALUES = ['suggested', 'accepted', 'dismissed'] as const;

export type MatchSuggestionStatus = (typeof MATCH_SUGGESTION_STATUS_VALUES)[number];

export type MatchSuggestionExplanation = {
  score: number;
  reasons: string[];
  signals: {
    desiredHelp: string[];
    targetCompanies: string[];
    targetIndustries: string[];
    communities: string[];
    availability: HelperAvailabilityStatus | null;
  };
};

export type MatchSuggestion = {
  id: string;
  requestId: string;
  helperIdentityId: string;
  score: number;
  status: MatchSuggestionStatus;
  explanation: MatchSuggestionExplanation;
  createdAt: string;
  updatedAt: string;
};

export type MatchSuggestionInput = {
  requestId: string;
  helperIdentityId: string;
  score: number;
  explanation: MatchSuggestionExplanation;
  status?: MatchSuggestionStatus;
};

export type JobSeekerRequestRow = {
  id: string;
  identity_id: string;
  status: JobSeekerRequestStatus;
  headline: string;
  target_role: string;
  target_companies: string[] | null;
  target_locations: string[] | null;
  remote_preference: string | null;
  salary_expectation: string | null;
  work_authorization: string | null;
  notes: string | null;
  resume_url: string | null;
  created_at: string;
  updated_at: string;
  opened_at: string | null;
  closed_at: string | null;
};

export type HelperCapabilityRow = {
  id: string;
  identity_id: string;
  categories: string[] | null;
  availability: { status?: HelperAvailabilityStatus; weeklyIntroCapacity?: number } | null;
  industries: string[] | null;
  geographies: string[] | null;
  languages: string[] | null;
  allow_matching?: boolean | null;
  relationship_strength?: number | null;
};

type MatchSuggestionRow = {
  id: string;
  request_id: string;
  helper_identity_id: string;
  score: number;
  status: MatchSuggestionStatus;
  explanation: Json;
  created_at: string;
  updated_at: string;
};

type QueryResult<T> = Promise<{ data: T; error: Error | null }>;

export type MatchRepositorySupabaseClient = {
  from(table: string): any;
};

const REQUEST_COLUMNS =
  'id, identity_id, status, headline, target_role, target_companies, target_locations, remote_preference, salary_expectation, work_authorization, notes, resume_url, created_at, updated_at, opened_at, closed_at';
const HELPER_CAPABILITY_COLUMNS =
  'id, identity_id, categories, availability, industries, geographies, languages, allow_matching, relationship_strength';
const MATCH_SUGGESTION_COLUMNS =
  'id, request_id, helper_identity_id, score, status, explanation, created_at, updated_at';

export function createMatchSuggestionExplanation(input: {
  explanation: MatchExplanation;
  desiredHelp?: readonly string[];
  targetCompanies?: readonly string[];
  targetIndustries?: readonly string[];
  communities?: readonly string[];
  availability?: HelperAvailabilityStatus | null;
}): MatchSuggestionExplanation {
  return {
    score: input.explanation.score,
    reasons: input.explanation.reasons.map((reason) => reason.slice(0, 240)),
    signals: {
      desiredHelp: [...(input.desiredHelp ?? [])],
      targetCompanies: [...(input.targetCompanies ?? [])],
      targetIndustries: [...(input.targetIndustries ?? [])],
      communities: [...(input.communities ?? [])],
      availability: input.availability ?? null,
    },
  };
}

export function mapJobSeekerRequestRow(row: JobSeekerRequestRow): JobSeekerRequest {
  return {
    id: row.id,
    identityId: row.identity_id,
    status: row.status,
    headline: row.headline,
    targetRole: row.target_role,
    targetCompanies: row.target_companies ?? [],
    targetLocations: row.target_locations ?? [],
    remotePreference: row.remote_preference,
    salaryExpectation: row.salary_expectation,
    workAuthorization: row.work_authorization,
    notes: row.notes,
    resumeUrl: row.resume_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  };
}

function mapSuggestionRow(row: MatchSuggestionRow): MatchSuggestion {
  return {
    id: row.id,
    requestId: row.request_id,
    helperIdentityId: row.helper_identity_id,
    score: row.score,
    status: row.status,
    explanation: row.explanation as MatchSuggestionExplanation,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getJobSeekerRequestById(
  supabase: MatchRepositorySupabaseClient,
  requestId: string,
): Promise<JobSeekerRequest | null> {
  const { data, error } = (await supabase
    .from('job_seeker_requests')
    .select(REQUEST_COLUMNS)
    .eq('id', requestId)
    .maybeSingle()) as Awaited<QueryResult<JobSeekerRequestRow | null>>;

  if (error) throw error;
  return data ? mapJobSeekerRequestRow(data) : null;
}

export async function listEligibleHelperCapabilities(
  supabase: MatchRepositorySupabaseClient,
): Promise<HelperCapabilityRow[]> {
  const { data, error } = (await supabase
    .from('helper_capabilities')
    .select(HELPER_CAPABILITY_COLUMNS)) as Awaited<QueryResult<HelperCapabilityRow[]>>;

  if (error) throw error;
  return (data ?? []).filter((row) => row.availability?.status !== 'unavailable');
}

export async function createMatchSuggestion(
  supabase: MatchRepositorySupabaseClient,
  input: MatchSuggestionInput,
): Promise<MatchSuggestion> {
  const payload = {
    request_id: input.requestId,
    helper_identity_id: input.helperIdentityId,
    score: input.score,
    status: input.status ?? 'suggested',
    explanation: input.explanation as Json,
  };
  const { data, error } = (await supabase
    .from('match_suggestions')
    .upsert(payload, { onConflict: 'request_id,helper_identity_id' })
    .select(MATCH_SUGGESTION_COLUMNS)
    .single()) as Awaited<QueryResult<MatchSuggestionRow | null>>;

  if (error) throw error;
  if (!data) throw new Error('Match suggestion insert did not return a row.');
  return mapSuggestionRow(data);
}

export async function listMatchSuggestionsForRequest(
  supabase: MatchRepositorySupabaseClient,
  requestId: string,
): Promise<MatchSuggestion[]> {
  const { data, error } = (await supabase
    .from('match_suggestions')
    .select(MATCH_SUGGESTION_COLUMNS)
    .eq('request_id', requestId)
    .order('score', { ascending: false })
    .order('helper_identity_id', { ascending: true })) as Awaited<
    QueryResult<MatchSuggestionRow[]>
  >;

  if (error) throw error;
  return (data ?? []).map(mapSuggestionRow);
}

export async function updateMatchSuggestionStatus(
  supabase: MatchRepositorySupabaseClient,
  suggestionId: string,
  status: MatchSuggestionStatus,
): Promise<MatchSuggestion> {
  const { data, error } = (await supabase
    .from('match_suggestions')
    .update({ status })
    .eq('id', suggestionId)
    .select(MATCH_SUGGESTION_COLUMNS)
    .single()) as Awaited<QueryResult<MatchSuggestionRow | null>>;

  if (error) throw error;
  if (!data) throw new Error('Match suggestion update did not return a row.');
  return mapSuggestionRow(data);
}
