export const INTRODUCTION_FOLLOW_UP_STATUS_VALUES = [
  'scheduled',
  'sent',
  'completed',
  'canceled',
] as const;

export type IntroductionFollowUpStatus = (typeof INTRODUCTION_FOLLOW_UP_STATUS_VALUES)[number];

export interface IntroductionFollowUp {
  id: string;
  introductionId: string;
  requesterIdentityId: string;
  helperIdentityId: string;
  stewardIdentityId: string;
  dueAt: string;
  status: IntroductionFollowUpStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  reminderSentAt: string | null;
  notes: string | null;
}

export interface IntroductionFollowUpInput {
  introductionId: string;
  requesterIdentityId: string;
  helperIdentityId: string;
  stewardIdentityId: string;
  dueAt?: Date | string;
  status?: IntroductionFollowUpStatus;
  createdAt?: Date | string;
  notes?: string | null;
}

export interface NormalizedIntroductionFollowUpInput {
  introductionId: string;
  requesterIdentityId: string;
  helperIdentityId: string;
  stewardIdentityId: string;
  dueAt: string;
  status: IntroductionFollowUpStatus;
  createdAt: string;
  notes: string | null;
}

export type IntroductionFollowUpValidationResult = {
  valid: boolean;
  errors: Record<string, string[]>;
};

export const DEFAULT_FOLLOW_UP_DELAY_DAYS = 7;
const MAX_NOTES_LENGTH = 2_000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function isIntroductionFollowUpStatus(value: string): value is IntroductionFollowUpStatus {
  return (INTRODUCTION_FOLLOW_UP_STATUS_VALUES as readonly string[]).includes(value);
}

export function getDefaultFollowUpDueAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + DEFAULT_FOLLOW_UP_DELAY_DAYS * ONE_DAY_MS);
}

export function normalizeIntroductionFollowUpInput(
  input: IntroductionFollowUpInput,
  now: Date = new Date(),
): NormalizedIntroductionFollowUpInput {
  const createdAt = normalizeDate(input.createdAt ?? now, 'createdAt');

  return {
    introductionId: normalizeRequiredText(input.introductionId),
    requesterIdentityId: normalizeRequiredText(input.requesterIdentityId),
    helperIdentityId: normalizeRequiredText(input.helperIdentityId),
    stewardIdentityId: normalizeRequiredText(input.stewardIdentityId),
    dueAt: normalizeDate(input.dueAt ?? getDefaultFollowUpDueAt(new Date(createdAt)), 'dueAt'),
    status: input.status ?? 'scheduled',
    createdAt,
    notes: normalizeOptionalText(input.notes),
  };
}

export function validateIntroductionFollowUpInput(
  input: Partial<IntroductionFollowUpInput>,
): IntroductionFollowUpValidationResult {
  const errors: Record<string, string[]> = {};

  requireText(input.introductionId, 'introductionId', errors);
  requireText(input.requesterIdentityId, 'requesterIdentityId', errors);
  requireText(input.helperIdentityId, 'helperIdentityId', errors);
  requireText(input.stewardIdentityId, 'stewardIdentityId', errors);
  validateOptionalDate(input.dueAt, 'dueAt', errors);
  validateOptionalDate(input.createdAt, 'createdAt', errors);
  validateOptionalText(input.notes, 'notes', MAX_NOTES_LENGTH, errors);

  if (input.status !== undefined && !isIntroductionFollowUpStatus(input.status)) {
    addError(errors, 'status', 'Status is not supported.');
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function createIntroductionFollowUp(
  input: IntroductionFollowUpInput,
  options: { id?: string; now?: Date } = {},
): IntroductionFollowUp {
  const validation = validateIntroductionFollowUpInput(input);

  if (!validation.valid) {
    throw new Error(
      `Invalid introduction follow-up input: ${formatValidationErrors(validation.errors)}`,
    );
  }

  const normalized = normalizeIntroductionFollowUpInput(input, options.now);
  const nowIso = normalizeDate(options.now ?? normalized.createdAt, 'now');

  return {
    id: options.id ?? createDeterministicFollowUpId(normalized.introductionId, normalized.dueAt),
    introductionId: normalized.introductionId,
    requesterIdentityId: normalized.requesterIdentityId,
    helperIdentityId: normalized.helperIdentityId,
    stewardIdentityId: normalized.stewardIdentityId,
    dueAt: normalized.dueAt,
    status: normalized.status,
    createdAt: normalized.createdAt,
    updatedAt: nowIso,
    completedAt: normalized.status === 'completed' ? nowIso : null,
    reminderSentAt: normalized.status === 'sent' ? nowIso : null,
    notes: normalized.notes,
  };
}

export function isFollowUpDue(
  followUp: Pick<IntroductionFollowUp, 'dueAt' | 'status'>,
  now: Date = new Date(),
): boolean {
  return followUp.status === 'scheduled' && new Date(followUp.dueAt).getTime() <= now.getTime();
}

export function getDueIntroductionFollowUps<
  T extends Pick<IntroductionFollowUp, 'dueAt' | 'status'>,
>(followUps: readonly T[], now: Date = new Date()): T[] {
  return followUps.filter((followUp) => isFollowUpDue(followUp, now));
}

export function markIntroductionFollowUpReminderSent(
  followUp: IntroductionFollowUp,
  sentAt: Date | string = new Date(),
): IntroductionFollowUp {
  if (followUp.status !== 'scheduled') {
    throw new Error(`Only scheduled follow-ups can be marked sent; received "${followUp.status}".`);
  }

  const timestamp = normalizeDate(sentAt, 'sentAt');
  return { ...followUp, status: 'sent', reminderSentAt: timestamp, updatedAt: timestamp };
}

export function completeIntroductionFollowUp(
  followUp: IntroductionFollowUp,
  completedAt: Date | string = new Date(),
): IntroductionFollowUp {
  if (followUp.status === 'canceled') {
    throw new Error('Canceled follow-ups cannot be completed.');
  }

  const timestamp = normalizeDate(completedAt, 'completedAt');
  return { ...followUp, status: 'completed', completedAt: timestamp, updatedAt: timestamp };
}

function createDeterministicFollowUpId(introductionId: string, dueAt: string): string {
  return `follow-up-${introductionId}-${dueAt.slice(0, 10)}`;
}

function normalizeRequiredText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = normalizeRequiredText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeDate(value: Date | string, field: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} must be a valid date.`);
  }
  return date.toISOString();
}

function requireText(value: unknown, field: string, errors: Record<string, string[]>): void {
  if (typeof value !== 'string' || normalizeRequiredText(value).length === 0) {
    addError(errors, field, 'Required.');
  }
}

function validateOptionalText(
  value: unknown,
  field: string,
  maxLength: number,
  errors: Record<string, string[]>,
): void {
  if (value == null || value === '') return;
  if (typeof value !== 'string') {
    addError(errors, field, 'Must be text.');
    return;
  }
  if (normalizeRequiredText(value).length > maxLength) {
    addError(errors, field, `Must be ${maxLength} characters or fewer.`);
  }
}

function validateOptionalDate(
  value: unknown,
  field: string,
  errors: Record<string, string[]>,
): void {
  if (value === undefined) return;
  if (!(value instanceof Date) && typeof value !== 'string') {
    addError(errors, field, 'Must be a date.');
    return;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    addError(errors, field, 'Must be a valid date.');
  }
}

function addError(errors: Record<string, string[]>, field: string, message: string): void {
  errors[field] = [...(errors[field] ?? []), message];
}

function formatValidationErrors(errors: Record<string, string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
    .join('; ');
}
