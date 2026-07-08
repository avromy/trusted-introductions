import { createClient } from '@/lib/supabase/server';
import {
  normalizeJobSeekerRequestInput,
  serializeJobSeekerRequestForHelper,
} from '@/lib/matching/job-seeker';
import type {
  JobSeekerRequest,
  JobSeekerRequestInput,
  JobSeekerRequestStatus,
} from '@/types/matching';
import type { Database } from '@/types/supabase';

export type JobSeekerRequestRow = Database['public']['Tables']['job_seeker_requests']['Row'];

type QueryResult<T> = Promise<{ data: T; error: { message?: string } | Error | null }>;

type JobSeekerRequestQueryBuilder<T> = {
  select(columns?: string): JobSeekerRequestQueryBuilder<T>;
  insert(payload: unknown): JobSeekerRequestQueryBuilder<T>;
  update(payload: unknown): JobSeekerRequestQueryBuilder<T>;
  eq(column: string, value: unknown): JobSeekerRequestQueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): QueryResult<T[]>;
  maybeSingle(): QueryResult<T | null>;
  single(): QueryResult<T>;
};

export type JobSeekerRequestRepositoryClient = {
  from(table: 'job_seeker_requests'): JobSeekerRequestQueryBuilder<JobSeekerRequestRow>;
};

function getJobSeekerRequestRepositoryClient(
  client?: JobSeekerRequestRepositoryClient,
): JobSeekerRequestRepositoryClient {
  return client ?? (createClient() as unknown as JobSeekerRequestRepositoryClient);
}

function throwJobSeekerRequestRepositoryError(
  operation: string,
  error: { message?: string } | Error,
): never {
  throw new Error(`Failed to ${operation}: ${error.message ?? 'unknown Supabase error'}`);
}

export function mapJobSeekerRequestRow(row: JobSeekerRequestRow): JobSeekerRequest {
  return {
    id: row.id,
    identityId: row.identity_id,
    status: row.status,
    headline: row.headline,
    targetRole: row.target_role,
    targetCompanies: row.target_companies,
    targetLocations: row.target_locations,
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

export async function createJobSeekerRequest(
  input: JobSeekerRequestInput,
  client?: JobSeekerRequestRepositoryClient,
): Promise<JobSeekerRequest> {
  const normalized = normalizeJobSeekerRequestInput(input);
  const { data, error } = await getJobSeekerRequestRepositoryClient(client)
    .from('job_seeker_requests')
    .insert({
      identity_id: normalized.identityId,
      status: normalized.status,
      headline: normalized.headline,
      target_role: normalized.targetRole,
      target_companies: normalized.targetCompanies,
      target_locations: normalized.targetLocations,
      remote_preference: normalized.remotePreference,
      salary_expectation: normalized.salaryExpectation,
      work_authorization: normalized.workAuthorization,
      notes: normalized.notes,
      resume_url: normalized.resumeUrl,
      opened_at: normalized.status === 'open' ? new Date().toISOString() : null,
      closed_at:
        normalized.status === 'closed' || normalized.status === 'withdrawn'
          ? new Date().toISOString()
          : null,
    })
    .select('*')
    .single();

  if (error) {
    throwJobSeekerRequestRepositoryError('create job seeker request', error);
  }

  return serializeJobSeekerRequestForHelper(mapJobSeekerRequestRow(data));
}

export async function getJobSeekerRequestById(
  requestId: string,
  client?: JobSeekerRequestRepositoryClient,
): Promise<JobSeekerRequest | null> {
  const { data, error } = await getJobSeekerRequestRepositoryClient(client)
    .from('job_seeker_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (error) {
    throwJobSeekerRequestRepositoryError('get job seeker request by id', error);
  }

  return data ? serializeJobSeekerRequestForHelper(mapJobSeekerRequestRow(data)) : null;
}

export async function listJobSeekerRequestsByIdentity(
  identityId: string,
  client?: JobSeekerRequestRepositoryClient,
): Promise<JobSeekerRequest[]> {
  const { data, error } = await getJobSeekerRequestRepositoryClient(client)
    .from('job_seeker_requests')
    .select('*')
    .eq('identity_id', identityId)
    .order('created_at', { ascending: false });

  if (error) {
    throwJobSeekerRequestRepositoryError('list job seeker requests by identity', error);
  }

  return (data ?? []).map((row) => serializeJobSeekerRequestForHelper(mapJobSeekerRequestRow(row)));
}

export async function updateJobSeekerRequestStatus(
  requestId: string,
  status: JobSeekerRequestStatus,
  client?: JobSeekerRequestRepositoryClient,
): Promise<JobSeekerRequest> {
  const now = new Date().toISOString();
  const { data, error } = await getJobSeekerRequestRepositoryClient(client)
    .from('job_seeker_requests')
    .update({
      status,
      opened_at: status === 'open' ? now : undefined,
      closed_at: status === 'closed' || status === 'withdrawn' ? now : undefined,
    })
    .eq('id', requestId)
    .select('*')
    .single();

  if (error) {
    throwJobSeekerRequestRepositoryError('update job seeker request status', error);
  }

  return serializeJobSeekerRequestForHelper(mapJobSeekerRequestRow(data));
}
