import { describe, expect, it, vi } from 'vitest';

import {
  upsertHelperCapabilityAction,
  type HelperCapabilityActionClient,
} from '@/lib/matching/helper-capability-actions';
import {
  createHelperCapabilityRecord,
  getHelperCapabilityByIdentity,
  listHelperCapabilitiesByAvailability,
  mapHelperCapabilityRow,
  serializePersistedHelperCapabilityForPublic,
  upsertHelperCapability,
  type HelperCapabilityRow,
} from '@/lib/matching/helper-capability-repository';

const NOW = new Date('2026-07-08T12:00:00.000Z');

function row(overrides: Partial<HelperCapabilityRow> = {}): HelperCapabilityRow {
  return {
    id: 'capability-123',
    identity_id: 'identity-123',
    categories: ['resume_review'],
    availability_status: 'available',
    weekly_intro_capacity: 2,
    next_available_at: null,
    industries: ['Climate'],
    geographies: ['Remote'],
    languages: ['English'],
    private_notes: 'Only after warm handoff',
    created_at: '2026-07-08T00:00:00.000Z',
    updated_at: '2026-07-08T00:00:00.000Z',
    ...overrides,
  };
}

function createRepositoryClient(initialRows: HelperCapabilityRow[] = []) {
  const rows = [...initialRows];
  const inserts: unknown[] = [];
  const upserts: unknown[] = [];
  const filters: Array<[string, unknown]> = [];

  const client = {
    from: vi.fn((table: 'helper_capabilities') => ({
      select: vi.fn().mockReturnThis(),
      insert(payload: unknown) {
        inserts.push(payload);
        return this;
      },
      upsert(payload: unknown) {
        upserts.push(payload);
        return this;
      },
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return this;
      },
      order: vi.fn(async () => ({ data: rows, error: null })),
      maybeSingle: vi.fn(async () => ({ data: rows[0] ?? null, error: null })),
      single: vi.fn(async () => ({ data: rows[0] ?? row(), error: null })),
    })),
  };

  return { client, inserts, upserts, filters };
}

function createActionClient(options: {
  user?: { id: string; email?: string } | null;
  identity?: { id: string; status: 'active' | 'pending' } | null;
}) {
  const capabilityRows = [row()];
  const upserts: unknown[] = [];
  const auditEvents: unknown[] = [];

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: options.user ?? null }, error: null })),
    },
    from: vi.fn(
      (table: 'trusted_identities' | 'user_roles' | 'helper_capabilities' | 'audit_events') => {
        if (table === 'trusted_identities') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn(async () => ({
              data: options.identity
                ? {
                    id: options.identity.id,
                    status: options.identity.status,
                    user_id: options.user?.id ?? null,
                  }
                : null,
              error: null,
            })),
          };
        }

        if (table === 'user_roles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn(async () => ({ data: [], error: null })),
          };
        }

        if (table === 'helper_capabilities') {
          return {
            upsert(payload: unknown) {
              upserts.push(payload);
              return this;
            },
            select: vi.fn().mockReturnThis(),
            single: vi.fn(async () => ({ data: capabilityRows[0], error: null })),
          };
        }

        return {
          insert: vi.fn(async (payload: unknown) => {
            auditEvents.push(payload);
            return { error: null };
          }),
        };
      },
    ),
  } as unknown as HelperCapabilityActionClient;

  return { client, upserts, auditEvents };
}

describe('helper capability repository helpers', () => {
  it('maps and serializes persisted helper capabilities without private notes', () => {
    const capability = mapHelperCapabilityRow(row());

    expect(capability).toMatchObject({
      id: 'capability-123',
      identityId: 'identity-123',
      availability: { status: 'available', weeklyIntroCapacity: 2 },
      privateNotes: 'Only after warm handoff',
    });
    expect(serializePersistedHelperCapabilityForPublic(capability)).toEqual({
      id: 'capability-123',
      identityId: 'identity-123',
      categories: ['resume_review'],
      availability: { status: 'available', weeklyIntroCapacity: 2, nextAvailableAt: null },
      industries: ['Climate'],
      geographies: ['Remote'],
      languages: ['English'],
      createdAt: '2026-07-08T00:00:00.000Z',
      updatedAt: '2026-07-08T00:00:00.000Z',
    });
  });

  it('creates and upserts normalized helper capabilities owned by an identity', async () => {
    const { client, inserts, upserts } = createRepositoryClient([
      row({ categories: ['network_introduction'] }),
    ]);

    await createHelperCapabilityRecord(
      {
        identityId: ' identity-123 ',
        categories: ['network_introduction', 'unsupported' as never, 'network_introduction'],
        availability: { status: 'available', weeklyIntroCapacity: 3.8 },
        industries: [' Climate ', 'Climate'],
        privateNotes: '  Internal context  ',
      },
      client,
    );
    const upserted = await upsertHelperCapability(
      { identityId: 'identity-123', categories: ['resume_review'] },
      client,
    );

    expect(inserts[0]).toMatchObject({
      identity_id: 'identity-123',
      categories: ['network_introduction'],
      availability_status: 'available',
      weekly_intro_capacity: 3,
      industries: ['Climate'],
      private_notes: 'Internal context',
    });
    expect(upserts[0]).toMatchObject({
      identity_id: 'identity-123',
      categories: ['resume_review'],
    });
    expect(upserted.identityId).toBe('identity-123');
  });

  it('reads and lists capabilities by persisted identity and availability', async () => {
    const { client, filters } = createRepositoryClient([row()]);

    await expect(getHelperCapabilityByIdentity(' identity-123 ', client)).resolves.toMatchObject({
      id: 'capability-123',
    });
    await expect(listHelperCapabilitiesByAvailability('available', client)).resolves.toHaveLength(
      1,
    );
    expect(filters).toContainEqual(['identity_id', 'identity-123']);
    expect(filters).toContainEqual(['availability_status', 'available']);
  });
});

describe('upsertHelperCapabilityAction', () => {
  it('requires a signed-in trusted identity', async () => {
    const { client, upserts, auditEvents } = createActionClient({ user: null, identity: null });

    await expect(upsertHelperCapabilityAction({}, { supabase: client })).resolves.toMatchObject({
      ok: false,
      error: 'auth_required',
    });
    expect(upserts).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it('returns validation errors without persisting invalid input', async () => {
    const { client, upserts, auditEvents } = createActionClient({
      user: { id: 'user-123', email: 'person@example.com' },
      identity: { id: 'identity-123', status: 'active' },
    });

    const result = await upsertHelperCapabilityAction({ categories: [] }, { supabase: client });

    expect(result).toMatchObject({ ok: false, error: 'validation' });
    expect(upserts).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it('persists owner identity, writes audit, and returns privacy-safe data', async () => {
    const { client, upserts, auditEvents } = createActionClient({
      user: { id: 'user-123', email: 'person@example.com' },
      identity: { id: 'identity-123', status: 'active' },
    });

    const result = await upsertHelperCapabilityAction(
      {
        categories: ['resume_review'],
        availability: { status: 'available', weeklyIntroCapacity: 2 },
        privateNotes: 'Do not expose',
      },
      { supabase: client, now: NOW },
    );

    expect(result).toMatchObject({ ok: true, capability: { id: 'capability-123' } });
    expect(upserts[0]).toMatchObject({ identity_id: 'identity-123' });
    expect(auditEvents).toEqual([
      expect.objectContaining({
        event_type: 'helper_capability.upserted',
        actor_id: 'identity-123',
        target_id: 'capability-123',
        occurred_at: '2026-07-08T12:00:00.000Z',
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain('Do not expose');
    expect(JSON.stringify(result)).not.toContain('Only after warm handoff');
  });
});
