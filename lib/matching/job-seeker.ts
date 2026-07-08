import {
  ACTIVE_JOB_SEEKER_REQUEST_STATUSES,
  JOB_SEEKER_REQUEST_STATUS_VALUES,
  type JobSeekerRequest,
  type JobSeekerRequestInput,
  type JobSeekerRequestStatus,
  type JobSeekerRequestValidationResult,
  type PublicJobSeekerRequest,
} from '@/types/matching';

const MAX_HEADLINE_LENGTH = 140;
const MAX_TARGET_ROLE_LENGTH = 120;
const MAX_LIST_ITEMS = 20;
const MAX_LIST_ITEM_LENGTH = 120;
const MAX_SHORT_TEXT_LENGTH = 160;
const MAX_NOTES_LENGTH = 2_000;

const TERMINAL_STATUSES = [
  'closed',
  'withdrawn',
] as const satisfies readonly JobSeekerRequestStatus[];

export function isJobSeekerRequestStatus(value: string): value is JobSeekerRequestStatus {
  return (JOB_SEEKER_REQUEST_STATUS_VALUES as readonly string[]).includes(value);
}

export function isActiveJobSeekerRequestStatus(status: JobSeekerRequestStatus): boolean {
  return (ACTIVE_JOB_SEEKER_REQUEST_STATUSES as readonly string[]).includes(status);
}

export function isTerminalJobSeekerRequestStatus(status: JobSeekerRequestStatus): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function getDefaultJobSeekerRequestStatus(): JobSeekerRequestStatus {
  return 'draft';
}

export function normalizeJobSeekerRequestInput(
  input: JobSeekerRequestInput,
): JobSeekerRequestInput {
  return {
    ...input,
    identityId: normalizeRequiredText(input.identityId),
    headline: normalizeRequiredText(input.headline),
    targetRole: normalizeRequiredText(input.targetRole),
    targetCompanies: normalizeStringList(input.targetCompanies),
    targetLocations: normalizeStringList(input.targetLocations),
    remotePreference: normalizeOptionalText(input.remotePreference),
    salaryExpectation: normalizeOptionalText(input.salaryExpectation),
    workAuthorization: normalizeOptionalText(input.workAuthorization),
    notes: normalizeOptionalText(input.notes),
    resumeUrl: normalizeOptionalText(input.resumeUrl),
    status: input.status ?? getDefaultJobSeekerRequestStatus(),
  };
}

export function validateJobSeekerRequestInput(
  input: Partial<JobSeekerRequestInput>,
): JobSeekerRequestValidationResult {
  const errors: Record<string, string[]> = {};

  requireText(input.identityId, 'identityId', errors);
  validateText(input.headline, 'headline', MAX_HEADLINE_LENGTH, errors);
  validateText(input.targetRole, 'targetRole', MAX_TARGET_ROLE_LENGTH, errors);
  validateStringList(input.targetCompanies, 'targetCompanies', errors);
  validateStringList(input.targetLocations, 'targetLocations', errors);
  validateOptionalText(input.remotePreference, 'remotePreference', MAX_SHORT_TEXT_LENGTH, errors);
  validateOptionalText(input.salaryExpectation, 'salaryExpectation', MAX_SHORT_TEXT_LENGTH, errors);
  validateOptionalText(input.workAuthorization, 'workAuthorization', MAX_SHORT_TEXT_LENGTH, errors);
  validateOptionalText(input.notes, 'notes', MAX_NOTES_LENGTH, errors);
  validateOptionalText(input.resumeUrl, 'resumeUrl', MAX_SHORT_TEXT_LENGTH * 4, errors);

  if (input.status !== undefined && !isJobSeekerRequestStatus(input.status)) {
    addError(errors, 'status', 'Status is not supported.');
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function assertValidJobSeekerRequestInput(
  input: Partial<JobSeekerRequestInput>,
): asserts input is JobSeekerRequestInput {
  const result = validateJobSeekerRequestInput(input);

  if (!result.valid) {
    throw new Error(`Invalid job seeker request input: ${formatValidationErrors(result.errors)}`);
  }
}

export function serializeJobSeekerRequestForPublic(
  request: JobSeekerRequest,
): PublicJobSeekerRequest {
  const {
    identityId: _identityId,
    salaryExpectation: _salaryExpectation,
    workAuthorization: _workAuthorization,
    notes: _notes,
    resumeUrl,
    ...safeRequest
  } = request;

  return {
    ...safeRequest,
    targetCompanies: [...request.targetCompanies],
    targetLocations: [...request.targetLocations],
    hasResume: Boolean(resumeUrl),
  };
}

export function serializeJobSeekerRequestForHelper(request: JobSeekerRequest): JobSeekerRequest {
  return {
    ...request,
    targetCompanies: [...request.targetCompanies],
    targetLocations: [...request.targetLocations],
  };
}

function normalizeRequiredText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const normalized = normalizeRequiredText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeStringList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map(normalizeRequiredText).filter(Boolean))];
}

function requireText(value: unknown, field: string, errors: Record<string, string[]>): void {
  if (typeof value !== 'string' || normalizeRequiredText(value).length === 0) {
    addError(errors, field, 'Required.');
  }
}

function validateText(
  value: unknown,
  field: string,
  maxLength: number,
  errors: Record<string, string[]>,
): void {
  requireText(value, field, errors);

  if (typeof value === 'string' && normalizeRequiredText(value).length > maxLength) {
    addError(errors, field, `Must be ${maxLength} characters or fewer.`);
  }
}

function validateOptionalText(
  value: unknown,
  field: string,
  maxLength: number,
  errors: Record<string, string[]>,
): void {
  if (value == null || value === '') {
    return;
  }

  if (typeof value !== 'string') {
    addError(errors, field, 'Must be text.');
    return;
  }

  if (normalizeRequiredText(value).length > maxLength) {
    addError(errors, field, `Must be ${maxLength} characters or fewer.`);
  }
}

function validateStringList(value: unknown, field: string, errors: Record<string, string[]>): void {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    addError(errors, field, 'Must be a list.');
    return;
  }

  if (value.length > MAX_LIST_ITEMS) {
    addError(errors, field, `Must include ${MAX_LIST_ITEMS} items or fewer.`);
  }

  value.forEach((item, index) => {
    if (typeof item !== 'string' || normalizeRequiredText(item).length === 0) {
      addError(errors, field, `Item ${index + 1} must be text.`);
      return;
    }

    if (normalizeRequiredText(item).length > MAX_LIST_ITEM_LENGTH) {
      addError(
        errors,
        field,
        `Item ${index + 1} must be ${MAX_LIST_ITEM_LENGTH} characters or fewer.`,
      );
    }
  });
}

function addError(errors: Record<string, string[]>, field: string, message: string): void {
  errors[field] = [...(errors[field] ?? []), message];
}

function formatValidationErrors(errors: Record<string, string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
    .join('; ');
}
