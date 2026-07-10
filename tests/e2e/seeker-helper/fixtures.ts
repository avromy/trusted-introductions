import { vi } from 'vitest';

import type { HelperCapabilityActionClient } from '@/lib/matching/helper-capability-actions';
import type { HelperCapabilityRow } from '@/lib/matching/helper-capability-repository';
import type { JobSeekerRequestActionClient } from '@/lib/matching/job-seeker-actions';
import type { JobSeekerRequestRow } from '@/lib/matching/job-seeker-repository';

type TestUser = { id: string; email?: string } | null;
type TestIdentity = { id: string; status: 'active' | 'pending' } | null;

export const seekerRecord = {
  user: { id: 'e2e-seeker-user', email: 'seeker-e2e@example.com' },
  identity: { id: 'e2e-seeker-identity', status: 'active' as const },
};

export const helperRecord = {
  user: { id: 'e2e-helper-user', email: 'helper-e2e@example.com' },
  identity: { id: 'e2e-helper-identity', status: 'active' as const },
};

export function deterministicJobSeekerRow(
  overrides: Partial<JobSeekerRequestRow> = {},
): JobSeekerRequestRow {
  return {
    id: 'e2e-request-001',
    identity_id: seekerRecord.identity.id,
    status: 'open',
    headline: 'E2E seeker requests product leadership introductions',
    target_role: 'Senior Product Manager',
    target_companies: ['Acme Robotics', 'Globex Climate'],
    target_locations: ['Remote', 'New York'],
    remote_preference: 'Remote-first',
    salary_expectation: '$150k+',
    work_authorization: 'US citizen',
    notes: 'E2E steward-only seeker routing note',
    resume_url: 'https://example.com/e2e-seeker-resume.pdf',
    opened_at: null,
    closed_at: null,
    created_at: '2026-07-10T00:00:00.000Z',
    updated_at: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

export function deterministicHelperRow(
  overrides: Partial<HelperCapabilityRow> = {},
): HelperCapabilityRow {
  return {
    id: 'e2e-helper-capability-001',
    identity_id: helperRecord.identity.id,
    categories: ['resume_review', 'network_introduction'],
    availability_status: 'limited',
    weekly_intro_capacity: 2,
    next_available_at: '2026-08-01T00:00:00.000Z',
    industries: ['Climate', 'Fintech'],
    geographies: ['Remote', 'US'],
    languages: ['English', 'Spanish'],
    private_notes: 'E2E private helper note: only warm handoffs.',
    created_at: '2026-07-10T00:00:00.000Z',
    updated_at: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

export function createE2EJobSeekerClient(options: {
  user?: TestUser;
  identity?: TestIdentity;
  row?: JobSeekerRequestRow;
} = {}) {
  const insertedRequests: unknown[] = [];
  const auditEvents: unknown[] = [];
  const row = options.row ?? deterministicJobSeekerRow();
  const user = options.user === undefined ? seekerRecord.user : options.user;
  const identity = options.identity === undefined ? seekerRecord.identity : options.identity;

  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: vi.fn((table: string) => {
      if (table === 'trusted_identities') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({
            data: identity ? { id: identity.id, status: identity.status, user_id: user?.id ?? null } : null,
            error: null,
          })),
        };
      }

      if (table === 'user_roles') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn(async () => ({ data: [], error: null })) };
      }

      if (table === 'job_seeker_requests') {
        return {
          insert(payload: unknown) {
            insertedRequests.push(payload);
            return this;
          },
          select: vi.fn().mockReturnThis(),
          single: vi.fn(async () => ({ data: row, error: null })),
        };
      }

      return { insert: vi.fn(async (payload: unknown) => { auditEvents.push(payload); return { error: null }; }) };
    }),
  } as unknown as JobSeekerRequestActionClient;

  return { client, insertedRequests, auditEvents };
}

export function createE2EHelperClient(options: {
  user?: TestUser;
  identity?: TestIdentity;
  row?: HelperCapabilityRow;
} = {}) {
  const upserts: unknown[] = [];
  const auditEvents: unknown[] = [];
  const row = options.row ?? deterministicHelperRow();
  const user = options.user === undefined ? helperRecord.user : options.user;
  const identity = options.identity === undefined ? helperRecord.identity : options.identity;

  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: vi.fn((table: string) => {
      if (table === 'trusted_identities') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({
            data: identity ? { id: identity.id, status: identity.status, user_id: user?.id ?? null } : null,
            error: null,
          })),
        };
      }

      if (table === 'user_roles') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn(async () => ({ data: [], error: null })) };
      }

      if (table === 'helper_capabilities') {
        return {
          upsert(payload: unknown) {
            upserts.push(payload);
            return this;
          },
          select: vi.fn().mockReturnThis(),
          single: vi.fn(async () => ({ data: row, error: null })),
        };
      }

      return { insert: vi.fn(async (payload: unknown) => { auditEvents.push(payload); return { error: null }; }) };
    }),
  } as unknown as HelperCapabilityActionClient;

  return { client, upserts, auditEvents };
}
