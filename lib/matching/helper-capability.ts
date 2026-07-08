export const HELPER_CAPABILITY_CATEGORY_VALUES = [
  'career_navigation',
  'resume_review',
  'interview_practice',
  'network_introduction',
  'industry_insight',
  'portfolio_review',
  'accountability',
  'resource_navigation',
] as const;

export type HelperCapabilityCategory = (typeof HELPER_CAPABILITY_CATEGORY_VALUES)[number];

export const HELPER_AVAILABILITY_STATUS_VALUES = ['available', 'limited', 'unavailable'] as const;

export type HelperAvailabilityStatus = (typeof HELPER_AVAILABILITY_STATUS_VALUES)[number];

export interface HelperCapabilityAvailability {
  status: HelperAvailabilityStatus;
  weeklyIntroCapacity: number;
  nextAvailableAt?: string | null;
}

export interface HelperCapabilityInput {
  categories: HelperCapabilityCategory[];
  availability?: Partial<HelperCapabilityAvailability> | null;
  industries?: string[] | null;
  geographies?: string[] | null;
  languages?: string[] | null;
  privateNotes?: string | null;
}

export interface HelperCapability extends HelperCapabilityInput {
  availability: HelperCapabilityAvailability;
}

export type SerializedHelperCapability = Omit<HelperCapability, 'privateNotes'>;

const DEFAULT_AVAILABILITY: HelperCapabilityAvailability = {
  status: 'limited',
  weeklyIntroCapacity: 1,
  nextAvailableAt: null,
};

const MAX_CATEGORIES = 8;
const MAX_WEEKLY_INTRO_CAPACITY = 20;
const MAX_LIST_ITEMS = 25;
const MAX_LABEL_LENGTH = 80;

export function isHelperCapabilityCategory(value: string): value is HelperCapabilityCategory {
  return (HELPER_CAPABILITY_CATEGORY_VALUES as readonly string[]).includes(value);
}

export function isHelperAvailabilityStatus(value: string): value is HelperAvailabilityStatus {
  return (HELPER_AVAILABILITY_STATUS_VALUES as readonly string[]).includes(value);
}

export function getDefaultHelperCapabilityAvailability(): HelperCapabilityAvailability {
  return { ...DEFAULT_AVAILABILITY };
}

export function normalizeHelperCapabilityCategories(
  categories: readonly string[] | null | undefined,
): HelperCapabilityCategory[] {
  if (!Array.isArray(categories)) {
    return [];
  }

  return Array.from(new Set(categories.filter(isHelperCapabilityCategory))).slice(
    0,
    MAX_CATEGORIES,
  );
}

export function normalizeHelperCapabilityLabels(
  values: readonly string[] | null | undefined,
): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalized = values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.slice(0, MAX_LABEL_LENGTH));

  return Array.from(new Set(normalized)).slice(0, MAX_LIST_ITEMS);
}

export function normalizeHelperCapabilityAvailability(
  availability?: Partial<HelperCapabilityAvailability> | null,
): HelperCapabilityAvailability {
  const status =
    availability?.status && isHelperAvailabilityStatus(availability.status)
      ? availability.status
      : DEFAULT_AVAILABILITY.status;
  const weeklyIntroCapacity = clampWeeklyIntroCapacity(availability?.weeklyIntroCapacity);
  const nextAvailableAt = normalizeIsoDate(availability?.nextAvailableAt);

  return {
    status: weeklyIntroCapacity === 0 ? 'unavailable' : status,
    weeklyIntroCapacity,
    nextAvailableAt,
  };
}

export function validateHelperCapabilityInput(
  input: Partial<HelperCapabilityInput> | null | undefined,
): string[] {
  const errors: string[] = [];
  const categories = normalizeHelperCapabilityCategories(input?.categories);
  const availability = normalizeHelperCapabilityAvailability(input?.availability);

  if (categories.length === 0) {
    errors.push('Select at least one helper capability category.');
  }

  if (availability.status !== 'unavailable' && availability.weeklyIntroCapacity < 1) {
    errors.push('Available helpers must have at least one weekly introduction slot.');
  }

  if (
    input?.availability?.nextAvailableAt &&
    !normalizeIsoDate(input.availability.nextAvailableAt)
  ) {
    errors.push('Next available date must be a valid ISO date string.');
  }

  return errors;
}

export function createHelperCapability(input: Partial<HelperCapabilityInput>): HelperCapability {
  return {
    categories: normalizeHelperCapabilityCategories(input.categories),
    availability: normalizeHelperCapabilityAvailability(input.availability),
    industries: normalizeHelperCapabilityLabels(input.industries),
    geographies: normalizeHelperCapabilityLabels(input.geographies),
    languages: normalizeHelperCapabilityLabels(input.languages),
    privateNotes: input.privateNotes?.trim() || null,
  };
}

export function isHelperAvailableForIntroduction(
  capability?: Pick<HelperCapability, 'availability'> | null,
): boolean {
  const availability = normalizeHelperCapabilityAvailability(capability?.availability);

  return availability.status !== 'unavailable' && availability.weeklyIntroCapacity > 0;
}

export function serializeHelperCapability(
  capability: HelperCapability,
): SerializedHelperCapability {
  return {
    categories: [...capability.categories],
    availability: { ...capability.availability },
    industries: [...normalizeHelperCapabilityLabels(capability.industries)],
    geographies: [...normalizeHelperCapabilityLabels(capability.geographies)],
    languages: [...normalizeHelperCapabilityLabels(capability.languages)],
  };
}

function clampWeeklyIntroCapacity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_AVAILABILITY.weeklyIntroCapacity;
  }

  return Math.min(Math.max(Math.floor(value), 0), MAX_WEEKLY_INTRO_CAPACITY);
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}
