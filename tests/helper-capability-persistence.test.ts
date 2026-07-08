import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveHelperCapabilityAction } from '@/lib/matching/helper-capability-actions';
import {
  createHelperCapabilityUpsertPayload,
  getHelperCapabilityByIdentityId,
  updateHelperCapabilityAvailability,
  upsertHelperCapability,
  type HelperCapabilitySupabaseClient,
} from '@/lib/matching/helper-capability-repository';
import type { Database } from '@/types/supabase';

type HelperCapabilityRow = Database['public']['Tables']['helper_capabilities']['Row'];

const mockCreateClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

const IDENTITY_ID = 'identity-123';

function capabilityRow(overrides: Partial<HelperCapabilityRow> = {}): HelperCapabilityRow {
  return {
    id: 'capability-123',
    identity_id: IDENTITY_ID,
    categories: ['resume_review'],
    industries: ['Tech'],
    geographies: ['Remote'],
    languages: ['English'],
    availability_status: 'limited',
    weekly_intro_capacity: 1,
    next_available_at: null,
    visibility: 'private',
    private_notes: 'Sensitive helper context',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function createRepositorySupabaseMock(
  options: {
    maybeSingleData?: HelperCapabilityRow | null;
    maybeSingleError?: Error | null;
    singleData?: HelperCapabilityRow | null;
    singleError?: Error | null;
  } = {},
) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options.maybeSingleData ?? null,
    error: options.maybeSingleError ?? null,
  });
  const single = vi.fn().mockResolvedValue({
    data: options.singleData ?? capabilityRow(),
    error: options.singleError ?? null,
  });
  const selectAfterMutation = vi.fn(() => ({ single }));
  const upsert = vi.fn(() => ({ select: selectAfterMutation }));
  const update = vi.fn(() => ({ eq: vi.fn(() => ({ select: selectAfterMutation })) }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select, upsert, update }));

  return {
    supabase: { from } as unknown as HelperCapabilitySupabaseClient,
    calls: { eq, from, maybeSingle, select, selectAfterMutation, single, update, upsert },
  };
}

function createActionSupabaseMock(identityId = IDENTITY_ID) {
  const row = capabilityRow({ identity_id: identityId, visibility: 'community' });
  const single = vi.fn().mockResolvedValue({ data: row, error: null });
  const select = vi.fn(() => ({ single }));
  const upsert = vi.fn(() => ({ select }));
  const insert = vi.fn().mockResolvedValue({ error: null });
  const auth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'user-123', identities: [{ id: identityId }] } },
      error: null,
    }),
  };
  const client = {
    auth,
    from: vi.fn((table: string) => {
      if (table === 'helper_capabilities') {
        return { upsert };
      }

      if (table === 'audit_events') {
        return { insert };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return { auth, client, insert, row, upsert };
}

describe('helper capability repository helpers', () => {
  it('gets a safe helper capability by identity id', async () => {
    const { supabase, calls } = createRepositorySupabaseMock({
      maybeSingleData: capabilityRow({ private_notes: 'Do not return' }),
    });

    const result = await getHelperCapabilityByIdentityId(supabase, IDENTITY_ID);

    expect(result).toEqual({
      categories: ['resume_review'],
      availability: { status: 'limited', weeklyIntroCapacity: 1, nextAvailableAt: null },
      industries: ['Tech'],
      geographies: ['Remote'],
      languages: ['English'],
      visibility: 'private',
    });
    expect(JSON.stringify(result)).not.toContain('Do not return');
    expect(calls.from).toHaveBeenCalledWith('helper_capabilities');
    expect(calls.eq).toHaveBeenCalledWith('identity_id', IDENTITY_ID);
  });

  it('upserts capability preferences, availability, capacity, visibility, and private notes', async () => {
    const payload = createHelperCapabilityUpsertPayload(IDENTITY_ID, {
      categories: ['network_introduction'],
      availability: { status: 'available', weeklyIntroCapacity: 3 },
      industries: [' Climate '],
      geographies: ['NYC'],
      languages: ['English'],
      visibility: 'community',
      privateNotes: 'Only staff should see this',
    });

    expect(payload).toEqual({
      identity_id: IDENTITY_ID,
      categories: ['network_introduction'],
      industries: ['Climate'],
      geographies: ['NYC'],
      languages: ['English'],
      availability_status: 'available',
      weekly_intro_capacity: 3,
      next_available_at: null,
      visibility: 'community',
      private_notes: 'Only staff should see this',
    });

    const { supabase, calls } = createRepositorySupabaseMock();

    await upsertHelperCapability(supabase, IDENTITY_ID, {
      categories: ['network_introduction'],
      visibility: 'community',
      privateNotes: 'Only staff should see this',
    });

    expect(calls.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        identity_id: IDENTITY_ID,
        categories: ['network_introduction'],
        visibility: 'community',
        private_notes: 'Only staff should see this',
      }),
      { onConflict: 'identity_id' },
    );
  });

  it('updates only helper capability availability fields', async () => {
    const { supabase, calls } = createRepositorySupabaseMock({
      singleData: capabilityRow({ availability_status: 'available', weekly_intro_capacity: 5 }),
    });

    await updateHelperCapabilityAvailability(supabase, IDENTITY_ID, {
      status: 'available',
      weeklyIntroCapacity: 5,
    });

    expect(calls.update).toHaveBeenCalledWith({
      availability_status: 'available',
      weekly_intro_capacity: 5,
      next_available_at: null,
    });
  });
});

describe('saveHelperCapabilityAction', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
  });

  it('requires a current trusted identity before saving settings', async () => {
    const supabase = createActionSupabaseMock();
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    mockCreateClient.mockReturnValueOnce(supabase.client);

    await expect(
      saveHelperCapabilityAction({ categories: ['resume_review'] }),
    ).rejects.toMatchObject({
      code: 'AUTH_IDENTITY_REQUIRED',
    });
    expect(supabase.upsert).not.toHaveBeenCalled();
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it('returns safe validation results without writing invalid capability input', async () => {
    const result = await saveHelperCapabilityAction({
      categories: [],
      privateNotes: 'Never expose invalid notes',
    });

    expect(result).toEqual({
      ok: false,
      errors: ['Select at least one helper capability category.'],
      capability: {
        categories: [],
        availability: { status: 'limited', weeklyIntroCapacity: 1, nextAvailableAt: null },
        industries: [],
        geographies: [],
        languages: [],
        visibility: 'private',
      },
    });
    expect(JSON.stringify(result)).not.toContain('Never expose invalid notes');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('persists capability settings, returns safe shapes, and audits sensitive mutation', async () => {
    const supabase = createActionSupabaseMock('identity-safe');
    mockCreateClient.mockReturnValueOnce(supabase.client);

    const result = await saveHelperCapabilityAction({
      categories: ['resume_review'],
      availability: { status: 'limited', weeklyIntroCapacity: 1 },
      industries: ['Tech'],
      geographies: ['Remote'],
      languages: ['English'],
      visibility: 'community',
      privateNotes: 'Do not expose this',
    });

    expect(result).toEqual({
      ok: true,
      capability: {
        categories: ['resume_review'],
        availability: { status: 'limited', weeklyIntroCapacity: 1, nextAvailableAt: null },
        industries: ['Tech'],
        geographies: ['Remote'],
        languages: ['English'],
        visibility: 'community',
      },
    });
    expect(JSON.stringify(result)).not.toContain('Do not expose this');
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ private_notes: 'Do not expose this', visibility: 'community' }),
      { onConflict: 'identity_id' },
    );
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'helper_capability.updated',
        actor_type: 'user',
        actor_id: 'identity-safe',
        target_type: 'trusted_identity',
        target_id: 'identity-safe',
        metadata: { capability: result.capability },
      }),
    );
  });
});
