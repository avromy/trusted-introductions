import {
  createHelperCapability,
  getDefaultHelperCapabilityAvailability,
  serializeHelperCapability,
  type HelperCapability,
  type HelperCapabilityAvailability,
  type HelperCapabilityInput,
  type SerializedHelperCapability,
} from '@/lib/matching/helper-capability';
import type { Database } from '@/types/supabase';

type HelperCapabilityRow = Database['public']['Tables']['helper_capabilities']['Row'];
type StoredPrivacyVisibility = Database['public']['Enums']['privacy_visibility'];

const HELPER_CAPABILITY_SELECT_COLUMNS =
  'id, identity_id, categories, industries, geographies, languages, availability_status, weekly_intro_capacity, next_available_at, visibility, private_notes, created_at, updated_at';

export type HelperCapabilitySafeResult = SerializedHelperCapability & {
  visibility: StoredPrivacyVisibility;
};

export type HelperCapabilityUpsertInput = HelperCapabilityInput & {
  visibility?: StoredPrivacyVisibility | null;
};

export type HelperCapabilityUpsertPayload = {
  identity_id: string;
  categories: string[];
  industries: string[];
  geographies: string[];
  languages: string[];
  availability_status: HelperCapabilityAvailability['status'];
  weekly_intro_capacity: number;
  next_available_at: string | null;
  visibility: StoredPrivacyVisibility;
  private_notes: string | null;
};

type HelperCapabilitySelectResult = {
  data: HelperCapabilityRow | null;
  error: Error | null;
};

type HelperCapabilityMutationResult = {
  data: HelperCapabilityRow | null;
  error: Error | null;
};

type HelperCapabilityQueryBuilder = {
  select(columns: string): HelperCapabilityQueryBuilder;
  eq(column: 'identity_id', value: string): HelperCapabilityQueryBuilder;
  maybeSingle(): Promise<HelperCapabilitySelectResult>;
};

type HelperCapabilityUpsertBuilder = {
  select(columns: string): HelperCapabilityUpsertBuilder;
  single(): Promise<HelperCapabilityMutationResult>;
};

type HelperCapabilityUpdateBuilder = {
  eq(column: 'identity_id', value: string): HelperCapabilityUpdateBuilder;
  select(columns: string): HelperCapabilityUpdateBuilder;
  single(): Promise<HelperCapabilityMutationResult>;
};

export type HelperCapabilitySupabaseClient = {
  from(table: 'helper_capabilities'): HelperCapabilityQueryBuilder & {
    upsert(
      payload: HelperCapabilityUpsertPayload,
      options: { onConflict: 'identity_id' },
    ): HelperCapabilityUpsertBuilder;
    update(
      payload: Pick<
        HelperCapabilityUpsertPayload,
        'availability_status' | 'weekly_intro_capacity' | 'next_available_at'
      >,
    ): HelperCapabilityUpdateBuilder;
  };
};

function isStoredPrivacyVisibility(value: unknown): value is StoredPrivacyVisibility {
  return value === 'private' || value === 'community' || value === 'stewards';
}

function normalizeStoredVisibility(value: unknown): StoredPrivacyVisibility {
  return isStoredPrivacyVisibility(value) ? value : 'private';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function mapHelperCapabilityRow(row: HelperCapabilityRow): HelperCapabilitySafeResult {
  const capability = createHelperCapability({
    categories: stringArray(row.categories) as HelperCapabilityInput['categories'],
    industries: stringArray(row.industries),
    geographies: stringArray(row.geographies),
    languages: stringArray(row.languages),
    availability: {
      status: row.availability_status,
      weeklyIntroCapacity: row.weekly_intro_capacity,
      nextAvailableAt: row.next_available_at,
    },
    privateNotes: row.private_notes,
  });

  return {
    ...serializeHelperCapability(capability),
    visibility: normalizeStoredVisibility(row.visibility),
  };
}

export function createHelperCapabilityUpsertPayload(
  identityId: string,
  input: HelperCapabilityUpsertInput,
): HelperCapabilityUpsertPayload {
  const capability = createHelperCapability(input);

  return {
    identity_id: identityId,
    categories: [...capability.categories],
    industries: [...(capability.industries ?? [])],
    geographies: [...(capability.geographies ?? [])],
    languages: [...(capability.languages ?? [])],
    availability_status: capability.availability.status,
    weekly_intro_capacity: capability.availability.weeklyIntroCapacity,
    next_available_at: capability.availability.nextAvailableAt ?? null,
    visibility: normalizeStoredVisibility(input.visibility),
    private_notes: capability.privateNotes ?? null,
  };
}

export async function getHelperCapabilityByIdentityId(
  supabase: HelperCapabilitySupabaseClient,
  identityId: string,
): Promise<HelperCapabilitySafeResult | null> {
  const { data, error } = await supabase
    .from('helper_capabilities')
    .select(HELPER_CAPABILITY_SELECT_COLUMNS)
    .eq('identity_id', identityId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data === null ? null : mapHelperCapabilityRow(data);
}

export async function upsertHelperCapability(
  supabase: HelperCapabilitySupabaseClient,
  identityId: string,
  input: HelperCapabilityUpsertInput,
): Promise<HelperCapabilitySafeResult> {
  const { data, error } = await supabase
    .from('helper_capabilities')
    .upsert(createHelperCapabilityUpsertPayload(identityId, input), { onConflict: 'identity_id' })
    .select(HELPER_CAPABILITY_SELECT_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  if (data === null) {
    throw new Error('Helper capability upsert did not return a row.');
  }

  return mapHelperCapabilityRow(data);
}

export async function updateHelperCapabilityAvailability(
  supabase: HelperCapabilitySupabaseClient,
  identityId: string,
  availability: Partial<HelperCapability['availability']>,
): Promise<HelperCapabilitySafeResult> {
  const normalized = createHelperCapability({
    categories: ['resume_review'],
    availability: { ...getDefaultHelperCapabilityAvailability(), ...availability },
  }).availability;

  const { data, error } = await supabase
    .from('helper_capabilities')
    .update({
      availability_status: normalized.status,
      weekly_intro_capacity: normalized.weeklyIntroCapacity,
      next_available_at: normalized.nextAvailableAt ?? null,
    })
    .eq('identity_id', identityId)
    .select(HELPER_CAPABILITY_SELECT_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  if (data === null) {
    throw new Error('Helper capability availability update did not return a row.');
  }

  return mapHelperCapabilityRow(data);
}
