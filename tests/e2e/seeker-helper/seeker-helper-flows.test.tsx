import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import HelperCapabilitiesPage from '@/app/helper/capabilities/page';
import { readHelperCapabilitiesFormData } from '@/app/helper/capabilities/form-state';
import NewJobSeekerRequestPage from '@/app/requests/new/page';
import { createJobSeekerRequestAction, type JobSeekerRequestActionClient } from '@/lib/matching/job-seeker-actions';
import { upsertHelperCapabilityAction, type HelperCapabilityActionClient } from '@/lib/matching/helper-capability-actions';

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>();

  return {
    ...actual,
    useFormState: vi.fn((_action, initialState) => [initialState, '#']),
    useFormStatus: vi.fn(() => ({ pending: false })),
  };
});

const seekerRow = {
  id: 'e2e-request-b3',
  identity_id: 'e2e-seeker-b3',
  status: 'open',
  headline: 'B3 deterministic seeker needs platform intros',
  target_role: 'Senior Platform PM',
  target_companies: ['Acme', 'Globex'],
  target_locations: ['Remote', 'New York'],
  remote_preference: 'Remote-first',
  salary_expectation: '$180k+',
  work_authorization: 'US citizen',
  notes: 'B3 private seeker routing context',
  resume_url: 'https://example.com/b3-resume.pdf',
  opened_at: '2026-07-10T00:00:00.000Z',
  closed_at: null,
  created_at: '2026-07-10T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
};

const helperRow = {
  id: 'e2e-capability-b3',
  identity_id: 'e2e-helper-b3',
  categories: ['resume_review', 'network_introduction'],
  availability_status: 'limited',
  weekly_intro_capacity: 2,
  next_available_at: '2026-08-01T00:00:00.000Z',
  industries: ['Climate', 'Fintech'],
  geographies: ['US', 'Remote'],
  languages: ['English'],
  private_notes: 'B3 helper private steward-only note',
  created_at: '2026-07-10T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
};

function createTrustedActionClient<TTable extends 'job_seeker_requests' | 'helper_capabilities'>(options: {
  user: { id: string; email: string } | null;
  identity: { id: string; status: 'active' | 'pending' } | null;
  table: TTable;
  persistedRow: unknown;
}) {
  const writes: unknown[] = [];
  const auditEvents: unknown[] = [];

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: options.user }, error: null })),
    },
    from: vi.fn((table: string) => {
      if (table === 'trusted_identities') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({
            data: options.identity
              ? { id: options.identity.id, status: options.identity.status, user_id: options.user?.id ?? null }
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

      if (table === options.table) {
        return {
          insert(payload: unknown) {
            writes.push(payload);
            return this;
          },
          upsert(payload: unknown) {
            writes.push(payload);
            return this;
          },
          select: vi.fn().mockReturnThis(),
          single: vi.fn(async () => ({ data: options.persistedRow, error: null })),
        };
      }

      return {
        insert: vi.fn(async (payload: unknown) => {
          auditEvents.push(payload);
          return { error: null };
        }),
      };
    }),
  };

  return { client, writes, auditEvents };
}

describe('seeker/helper browser E2E coverage', () => {
  it('exposes stable browser selectors for seeker and helper intake surfaces without leaking private helper notes', () => {
    const seekerMarkup = renderToStaticMarkup(<NewJobSeekerRequestPage />);
    const helperMarkup = renderToStaticMarkup(<HelperCapabilitiesPage />);

    expect(seekerMarkup).toContain('data-testid="seeker-request-form"');
    expect(seekerMarkup).toContain('data-testid="seeker-request-headline"');
    expect(seekerMarkup).toContain('required=""');
    expect(helperMarkup).toContain('data-testid="helper-capabilities-form"');
    expect(helperMarkup).toContain('data-testid="helper-capability-category-network_introduction"');
    expect(helperMarkup).toContain('data-testid="helper-capability-availability"');
    expect(helperMarkup).toContain('data-testid="helper-capability-weekly-capacity"');
    expect(helperMarkup).toContain('data-testid="helper-capability-private-notes"');
    expect(helperMarkup).toContain('not included in public helper capability output');
    expect(helperMarkup).not.toContain(helperRow.private_notes);
  });

  it('validates required seeker fields before persisting', async () => {
    const { client, writes, auditEvents } = createTrustedActionClient({
      user: { id: 'e2e-user-b3', email: 'seeker-b3@example.com' },
      identity: { id: 'e2e-seeker-b3', status: 'active' },
      table: 'job_seeker_requests',
      persistedRow: seekerRow,
    });

    await expect(
      createJobSeekerRequestAction({ headline: '', targetRole: '' }, { supabase: client as unknown as JobSeekerRequestActionClient }),
    ).resolves.toMatchObject({ ok: false, error: 'validation' });
    expect(writes).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it('creates an authenticated seeker request and confirms persisted safe output', async () => {
    const { client, writes } = createTrustedActionClient({
      user: { id: 'e2e-user-b3', email: 'seeker-b3@example.com' },
      identity: { id: 'e2e-seeker-b3', status: 'active' },
      table: 'job_seeker_requests',
      persistedRow: seekerRow,
    });

    const result = await createJobSeekerRequestAction(
      {
        headline: seekerRow.headline,
        targetRole: seekerRow.target_role,
        targetCompanies: seekerRow.target_companies,
        targetLocations: seekerRow.target_locations,
        remotePreference: seekerRow.remote_preference,
        salaryExpectation: seekerRow.salary_expectation,
        workAuthorization: seekerRow.work_authorization,
        notes: seekerRow.notes,
        resumeUrl: seekerRow.resume_url,
        status: 'open',
      },
      { supabase: client as unknown as JobSeekerRequestActionClient },
    );

    expect(writes[0]).toMatchObject({ identity_id: 'e2e-seeker-b3', status: 'open', notes: seekerRow.notes });
    expect(result).toMatchObject({ ok: true, request: { headline: seekerRow.headline, hasResume: true } });
    expect(JSON.stringify(result)).not.toContain(seekerRow.notes);
    expect(JSON.stringify(result)).not.toContain(seekerRow.salary_expectation);
  });

  it('creates or updates helper capabilities with categories, availability, capacity, and private notes', async () => {
    const formData = new FormData();
    formData.append('categories', 'resume_review');
    formData.append('categories', 'network_introduction');
    formData.set('availabilityStatus', 'limited');
    formData.set('weeklyIntroCapacity', '2');
    formData.set('nextAvailableAt', '2026-08-01');
    formData.set('industries', 'Climate, Fintech');
    formData.set('geographies', 'US, Remote');
    formData.set('languages', 'English');
    formData.set('privateNotes', helperRow.private_notes);

    const parsed = readHelperCapabilitiesFormData(formData);
    const { client, writes } = createTrustedActionClient({
      user: { id: 'e2e-helper-user-b3', email: 'helper-b3@example.com' },
      identity: { id: 'e2e-helper-b3', status: 'active' },
      table: 'helper_capabilities',
      persistedRow: helperRow,
    });

    const result = await upsertHelperCapabilityAction(parsed, {
      supabase: client as unknown as HelperCapabilityActionClient,
    });

    expect(writes[0]).toMatchObject({
      identity_id: 'e2e-helper-b3',
      categories: ['resume_review', 'network_introduction'],
      availability_status: 'limited',
      weekly_intro_capacity: 2,
      next_available_at: '2026-08-01T00:00:00.000Z',
      private_notes: helperRow.private_notes,
    });
    expect(result).toMatchObject({ ok: true, capability: { categories: helperRow.categories } });
    expect(JSON.stringify(result)).not.toContain(helperRow.private_notes);
  });

  it('blocks unauthorized seeker requests and helper capability updates', async () => {
    const seeker = createTrustedActionClient({ user: null, identity: null, table: 'job_seeker_requests', persistedRow: seekerRow });
    const helper = createTrustedActionClient({ user: null, identity: null, table: 'helper_capabilities', persistedRow: helperRow });

    await expect(createJobSeekerRequestAction({ headline: seekerRow.headline, targetRole: seekerRow.target_role }, { supabase: seeker.client as unknown as JobSeekerRequestActionClient })).resolves.toMatchObject({ ok: false, error: 'auth_required' });
    await expect(upsertHelperCapabilityAction({ categories: ['resume_review'] }, { supabase: helper.client as unknown as HelperCapabilityActionClient })).resolves.toMatchObject({ ok: false, error: 'auth_required' });
    expect(seeker.writes).toEqual([]);
    expect(helper.writes).toEqual([]);
  });
});
