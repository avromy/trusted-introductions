import { describe, expect, it, vi } from 'vitest';

import {
  createJobSeekerRequestAction,
  type JobSeekerRequestActionClient,
} from '@/lib/matching/job-seeker-actions';
import {
  createJobSeekerRequest,
  getJobSeekerRequestById,
  listJobSeekerRequestsByIdentity,
  updateJobSeekerRequestStatus,
  type JobSeekerRequestRow,
} from '@/lib/matching/job-seeker-repository';

const NOW = new Date('2026-07-08T12:00:00.000Z');

function row(overrides: Partial<JobSeekerRequestRow> = {}): JobSeekerRequestRow {
  return {
    id: 'request-123',
    identity_id: 'identity-123',
    status: 'draft',
    headline: 'Product leader seeking warm introductions',
    target_role: 'Product Lead',
    target_companies: ['OpenAI'],
    target_locations: ['Remote'],
    remote_preference: 'Remote',
    salary_expectation: '$200k',
    work_authorization: 'US citizen',
    notes: 'Private notes',
    resume_url: 'https://example.com/resume.pdf',
    opened_at: null,
    closed_at: null,
    created_at: '2026-07-08T00:00:00.000Z',
    updated_at: '2026-07-08T00:00:00.000Z',
    ...overrides,
  };
}

function createRepositoryClient(initialRows: JobSeekerRequestRow[] = []) {
  const rows = [...initialRows];
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const filters: Array<[string, unknown]> = [];

  const client = {
    from: vi.fn((table: 'job_seeker_requests') => ({
      select: vi.fn().mockReturnThis(),
      insert(payload: unknown) {
        inserts.push(payload);
        return this;
      },
      update(payload: unknown) {
        updates.push(payload);
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

  return { client, inserts, updates, filters };
}

function createActionClient(options: {
  user?: { id: string; email?: string } | null;
  identity?: { id: string; status: 'active' | 'pending' } | null;
}) {
  const requestRows = [row()];
  const insertedRequests: unknown[] = [];
  const auditEvents: unknown[] = [];

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: options.user ?? null }, error: null })),
    },
    from: vi.fn(
      (table: 'trusted_identities' | 'user_roles' | 'job_seeker_requests' | 'audit_events') => {
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

        if (table === 'job_seeker_requests') {
          return {
            insert(payload: unknown) {
              insertedRequests.push(payload);
              return this;
            },
            select: vi.fn().mockReturnThis(),
            single: vi.fn(async () => ({ data: requestRows[0], error: null })),
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
  } as unknown as JobSeekerRequestActionClient;

  return { client, insertedRequests, auditEvents };
}

describe('job seeker request repository helpers', () => {
  it('creates normalized persisted requests owned by an identity', async () => {
    const { client, inserts } = createRepositoryClient([
      row({ headline: 'Seeking introductions' }),
    ]);

    const request = await createJobSeekerRequest(
      {
        identityId: ' identity-123 ',
        headline: ' Seeking   introductions ',
        targetRole: ' Product   Lead ',
        targetCompanies: ['OpenAI', ' OpenAI '],
        targetLocations: ['Remote'],
      },
      client,
    );

    expect(inserts[0]).toMatchObject({
      identity_id: 'identity-123',
      headline: 'Seeking introductions',
      target_role: 'Product Lead',
      target_companies: ['OpenAI'],
      target_locations: ['Remote'],
      status: 'draft',
    });
    expect(request.identityId).toBe('identity-123');
  });

  it('reads, lists, and updates request status', async () => {
    const { client, updates, filters } = createRepositoryClient([row({ status: 'open' })]);

    await expect(getJobSeekerRequestById('request-123', client)).resolves.toMatchObject({
      id: 'request-123',
    });
    await expect(listJobSeekerRequestsByIdentity('identity-123', client)).resolves.toHaveLength(1);
    await expect(
      updateJobSeekerRequestStatus('request-123', 'open', client),
    ).resolves.toMatchObject({ status: 'open' });

    expect(filters).toContainEqual(['id', 'request-123']);
    expect(filters).toContainEqual(['identity_id', 'identity-123']);
    expect(updates[0]).toMatchObject({ status: 'open' });
  });
});

describe('createJobSeekerRequestAction', () => {
  it('requires a signed-in trusted identity', async () => {
    const { client, insertedRequests, auditEvents } = createActionClient({
      user: null,
      identity: null,
    });

    await expect(createJobSeekerRequestAction({}, { supabase: client })).resolves.toMatchObject({
      ok: false,
      error: 'auth_required',
    });
    expect(insertedRequests).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it('returns safe validation errors without persisting invalid input', async () => {
    const { client, insertedRequests, auditEvents } = createActionClient({
      user: { id: 'user-123', email: 'person@example.com' },
      identity: { id: 'identity-123', status: 'active' },
    });

    const result = await createJobSeekerRequestAction(
      { headline: '', targetRole: '' },
      { supabase: client },
    );

    expect(result).toMatchObject({ ok: false, error: 'validation' });
    expect(insertedRequests).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it('ignores caller-supplied owner identities when creating requests', async () => {
    const { client, insertedRequests, auditEvents } = createActionClient({
      user: { id: 'user-123', email: 'person@example.com' },
      identity: { id: 'identity-123', status: 'active' },
    });

    await expect(
      createJobSeekerRequestAction(
        {
          headline: 'Product leader seeking intros',
          targetRole: 'Product Lead',
          identityId: 'identity-other',
        } as never,
        { supabase: client, now: NOW },
      ),
    ).resolves.toMatchObject({ ok: true });

    expect(insertedRequests[0]).toMatchObject({ identity_id: 'identity-123' });
    expect(JSON.stringify(insertedRequests)).not.toContain('identity-other');
    expect(auditEvents[0]).toMatchObject({ actor_id: 'identity-123' });
  });

  it('persists owner identity, writes audit, and returns privacy-safe data', async () => {
    const { client, insertedRequests, auditEvents } = createActionClient({
      user: { id: 'user-123', email: 'person@example.com' },
      identity: { id: 'identity-123', status: 'active' },
    });

    const result = await createJobSeekerRequestAction(
      { headline: 'Product leader seeking intros', targetRole: 'Product Lead' },
      { supabase: client, now: NOW },
    );

    expect(result).toMatchObject({ ok: true, request: { id: 'request-123', hasResume: true } });
    expect(insertedRequests[0]).toMatchObject({ identity_id: 'identity-123' });
    expect(auditEvents).toEqual([
      expect.objectContaining({
        event_type: 'job_seeker_request.created',
        actor_id: 'identity-123',
        target_id: 'request-123',
        occurred_at: '2026-07-08T12:00:00.000Z',
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain('identity-123');
    expect(JSON.stringify(result)).not.toContain('$200k');
    expect(JSON.stringify(result)).not.toContain('Private notes');
    expect(JSON.stringify(result)).not.toContain('https://example.com/resume.pdf');
  });
});
