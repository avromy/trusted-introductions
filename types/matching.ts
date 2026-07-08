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

export interface MatchSuggestion {
  id: string;
  requestId: string;
  helperIdentityId: string;
  helperCapabilityId: string;
  rank: number;
  score: number;
  reasons: string[];
  metadata: import('./supabase').Json;
  createdAt: string;
  updatedAt: string;
}

export interface MatchSuggestionInput {
  helperIdentityId: string;
  helperCapabilityId: string;
  rank: number;
  score: number;
  reasons: string[];
  metadata?: import('./supabase').Json;
}

export const STEWARD_REVIEW_STATUS_VALUES = ['pending', 'approved', 'rejected', 'needs_info'] as const;

export type StewardReviewStatus = (typeof STEWARD_REVIEW_STATUS_VALUES)[number];

export interface StewardReview {
  id: string;
  requestId: string;
  stewardIdentityId: string;
  subjectIdentityId: string;
  matchSuggestionId?: string | null;
  status: StewardReviewStatus;
  decisionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string | null;
}

export interface StewardReviewInput {
  requestId: string;
  stewardIdentityId: string;
  subjectIdentityId: string;
  matchSuggestionId?: string | null;
  status?: StewardReviewStatus;
  decisionReason?: string | null;
}

export type HelperAvailability = 'available' | 'limited' | 'unavailable';

export interface MatchingRequest {
  id?: string;
  desiredHelp?: readonly string[];
  targetCompanies?: readonly string[];
  targetIndustries?: readonly string[];
  communities?: readonly string[];
}

export interface HelperCandidate {
  id: string;
  displayName?: string;
  helpTypes?: readonly string[];
  companies?: readonly string[];
  industries?: readonly string[];
  communities?: readonly string[];
  availability?: HelperAvailability;
  relationshipStrength?: number;
  allowMatching?: boolean;
}

export interface MatchExplanation {
  score: number;
  reasons: string[];
}

export interface RankedHelperCandidate extends HelperCandidate {
  matchScore: number;
  matchExplanation: MatchExplanation;
}
