import { createClient } from '@/lib/supabase/server';
import {
  createHelperCapability,
  serializeHelperCapability,
  type HelperCapability,
  type HelperCapabilityAvailability,
  type HelperCapabilityInput,
  type SerializedHelperCapability,
} from '@/lib/matching/helper-capability';
import type { Database } from '@/types/supabase';

export type HelperCapabilityRow = Database['public']['Tables']['helper_capabilities']['Row'];

type QueryResult<T> = Promise<{ data: T; error: { message?: string } | Error | null }>;

type HelperCapabilityQueryBuilder<T> = {
  select(columns?: string): HelperCapabilityQueryBuilder<T>;
  insert(payload: unknown): HelperCapabilityQueryBuilder<T>;
  upsert(payload: unknown, options?: { onConflict?: string }): HelperCapabilityQueryBuilder<T>;
  eq(column: string, value: unknown): HelperCapabilityQueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): QueryResult<T[]>;
  maybeSingle(): QueryResult<T | null>;
  single(): QueryResult<T>;
};

export type HelperCapabilityRepositoryClient = {
  from(table: 'helper_capabilities'): HelperCapabilityQueryBuilder<HelperCapabilityRow>;
};

export interface PersistedHelperCapability extends HelperCapability {
  id: string;
  identityId: string;
  createdAt: string;
  updatedAt: string;
}

export type PublicPersistedHelperCapability = Omit<PersistedHelperCapability, 'privateNotes'>;

export type HelperCapabilityUpsertInput = Partial<HelperCapabilityInput> & {
  identityId: string;
};

function getHelperCapabilityRepositoryClient(
  client?: HelperCapabilityRepositoryClient,
): HelperCapabilityRepositoryClient {
  return client ?? (createClient() as unknown as HelperCapabilityRepositoryClient);
}

function throwHelperCapabilityRepositoryError(
  operation: string,
  error: { message?: string } | Error,
): never {
  throw new Error(`Failed to ${operation}: ${error.message ?? 'unknown Supabase error'}`);
}

function mapAvailability(row: HelperCapabilityRow): HelperCapabilityAvailability {
  return {
    status: row.availability_status,
    weeklyIntroCapacity: row.weekly_intro_capacity,
    nextAvailableAt: row.next_available_at,
  };
}

export function mapHelperCapabilityRow(row: HelperCapabilityRow): PersistedHelperCapability {
  return {
    id: row.id,
    identityId: row.identity_id,
    categories: row.categories,
    availability: mapAvailability(row),
    industries: row.industries,
    geographies: row.geographies,
    languages: row.languages,
    privateNotes: row.private_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializePersistedHelperCapabilityForPublic(
  capability: PersistedHelperCapability,
): PublicPersistedHelperCapability {
  return {
    id: capability.id,
    identityId: capability.identityId,
    ...serializeHelperCapability(capability),
    createdAt: capability.createdAt,
    updatedAt: capability.updatedAt,
  };
}

export async function upsertHelperCapability(
  input: HelperCapabilityUpsertInput,
  client?: HelperCapabilityRepositoryClient,
): Promise<PersistedHelperCapability> {
  const normalized = createHelperCapability(input);
  const identityId = input.identityId.trim();

  const { data, error } = await getHelperCapabilityRepositoryClient(client)
    .from('helper_capabilities')
    .upsert(
      {
        identity_id: identityId,
        categories: normalized.categories,
        availability_status: normalized.availability.status,
        weekly_intro_capacity: normalized.availability.weeklyIntroCapacity,
        next_available_at: normalized.availability.nextAvailableAt,
        industries: normalized.industries,
        geographies: normalized.geographies,
        languages: normalized.languages,
        private_notes: normalized.privateNotes,
      },
      { onConflict: 'identity_id' },
    )
    .select('*')
    .single();

  if (error) {
    throwHelperCapabilityRepositoryError('upsert helper capability', error);
  }

  return mapHelperCapabilityRow(data);
}

export async function createHelperCapabilityRecord(
  input: HelperCapabilityUpsertInput,
  client?: HelperCapabilityRepositoryClient,
): Promise<PersistedHelperCapability> {
  const normalized = createHelperCapability(input);
  const identityId = input.identityId.trim();

  const { data, error } = await getHelperCapabilityRepositoryClient(client)
    .from('helper_capabilities')
    .insert({
      identity_id: identityId,
      categories: normalized.categories,
      availability_status: normalized.availability.status,
      weekly_intro_capacity: normalized.availability.weeklyIntroCapacity,
      next_available_at: normalized.availability.nextAvailableAt,
      industries: normalized.industries,
      geographies: normalized.geographies,
      languages: normalized.languages,
      private_notes: normalized.privateNotes,
    })
    .select('*')
    .single();

  if (error) {
    throwHelperCapabilityRepositoryError('create helper capability', error);
  }

  return mapHelperCapabilityRow(data);
}

export async function getHelperCapabilityByIdentity(
  identityId: string,
  client?: HelperCapabilityRepositoryClient,
): Promise<PersistedHelperCapability | null> {
  const { data, error } = await getHelperCapabilityRepositoryClient(client)
    .from('helper_capabilities')
    .select('*')
    .eq('identity_id', identityId.trim())
    .maybeSingle();

  if (error) {
    throwHelperCapabilityRepositoryError('get helper capability by identity', error);
  }

  return data ? mapHelperCapabilityRow(data) : null;
}

export async function listHelperCapabilitiesByAvailability(
  availabilityStatus: HelperCapabilityAvailability['status'],
  client?: HelperCapabilityRepositoryClient,
): Promise<PersistedHelperCapability[]> {
  const { data, error } = await getHelperCapabilityRepositoryClient(client)
    .from('helper_capabilities')
    .select('*')
    .eq('availability_status', availabilityStatus)
    .order('updated_at', { ascending: false });

  if (error) {
    throwHelperCapabilityRepositoryError('list helper capabilities by availability', error);
  }

  return (data ?? []).map(mapHelperCapabilityRow);
}

export function serializeHelperCapabilityRowForPublic(
  row: HelperCapabilityRow,
): PublicPersistedHelperCapability {
  return serializePersistedHelperCapabilityForPublic(mapHelperCapabilityRow(row));
}
