export const JOB_SEEKER_REQUEST_STATUS_VALUES = [
  'draft',
  'open',
  'paused',
  'matched',
  'closed',
  'withdrawn',
] as const;

export type JobSeekerRequestStatus = (typeof JOB_SEEKER_REQUEST_STATUS_VALUES)[number];

export const ACTIVE_JOB_SEEKER_REQUEST_STATUSES = [
  'open',
  'paused',
  'matched',
] as const satisfies readonly JobSeekerRequestStatus[];

export type ActiveJobSeekerRequestStatus = (typeof ACTIVE_JOB_SEEKER_REQUEST_STATUSES)[number];

export interface JobSeekerRequest {
  id: string;
  identityId: string;
  status: JobSeekerRequestStatus;
  headline: string;
  targetRole: string;
  targetCompanies: string[];
  targetLocations: string[];
  remotePreference?: string | null;
  salaryExpectation?: string | null;
  workAuthorization?: string | null;
  notes?: string | null;
  resumeUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  openedAt?: string | null;
  closedAt?: string | null;
}

export interface JobSeekerRequestInput {
  identityId: string;
  headline: string;
  targetRole: string;
  targetCompanies?: string[];
  targetLocations?: string[];
  remotePreference?: string | null;
  salaryExpectation?: string | null;
  workAuthorization?: string | null;
  notes?: string | null;
  resumeUrl?: string | null;
  status?: JobSeekerRequestStatus;
}

export type PublicJobSeekerRequest = Omit<
  JobSeekerRequest,
  'identityId' | 'salaryExpectation' | 'workAuthorization' | 'notes' | 'resumeUrl'
> & {
  hasResume: boolean;
};

export interface JobSeekerRequestValidationResult {
  valid: boolean;
  errors: Record<string, string[]>;
}
