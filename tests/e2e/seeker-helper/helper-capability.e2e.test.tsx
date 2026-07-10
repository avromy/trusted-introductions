import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import HelperCapabilitiesPage from '@/app/helper/capabilities/page';
import { readHelperCapabilitiesFormData } from '@/app/helper/capabilities/form-state';
import { serializePersistedHelperCapabilityForPublic, mapHelperCapabilityRow } from '@/lib/matching/helper-capability-repository';
import { upsertHelperCapabilityAction } from '@/lib/matching/helper-capability-actions';
import { createE2EHelperClient, deterministicHelperRow } from './fixtures';

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>();
  return {
    ...actual,
    useFormState: vi.fn((_action, initialState) => [initialState, '#']),
    useFormStatus: vi.fn(() => ({ pending: false })),
  };
});

describe('helper capability browser E2E coverage', () => {
  it('renders category selection, availability, capacity, and private notes controls', () => {
    const markup = renderToStaticMarkup(<HelperCapabilitiesPage />);

    expect(markup).toContain('Describe how you can help');
    expect(markup).toContain('value="resume_review"');
    expect(markup).toContain('value="network_introduction"');
    expect(markup).toContain('name="availabilityStatus"');
    expect(markup).toContain('name="weeklyIntroCapacity"');
    expect(markup).toContain('name="privateNotes"');
    expect(markup).toContain('not included in public helper capability output');
  });

  it('parses browser form category, availability, capacity, labels, and private-note input', () => {
    const formData = new FormData();
    formData.append('categories', 'resume_review');
    formData.append('categories', 'network_introduction');
    formData.set('availabilityStatus', 'limited');
    formData.set('weeklyIntroCapacity', '2');
    formData.set('nextAvailableAt', '2026-08-01');
    formData.set('industries', 'Climate, Fintech');
    formData.set('geographies', 'Remote, US');
    formData.set('languages', 'English, Spanish');
    formData.set('privateNotes', 'E2E private helper note: only warm handoffs.');

    expect(readHelperCapabilitiesFormData(formData)).toEqual({
      categories: ['resume_review', 'network_introduction'],
      availability: { status: 'limited', weeklyIntroCapacity: 2, nextAvailableAt: '2026-08-01' },
      industries: ['Climate', 'Fintech'],
      geographies: ['Remote', 'US'],
      languages: ['English', 'Spanish'],
      privateNotes: 'E2E private helper note: only warm handoffs.',
    });
  });

  it('creates or updates a deterministic helper capability with availability and capacity persisted', async () => {
    const { client, upserts, auditEvents } = createE2EHelperClient();

    const result = await upsertHelperCapabilityAction(
      {
        categories: ['resume_review', 'network_introduction'],
        availability: { status: 'limited', weeklyIntroCapacity: 2, nextAvailableAt: '2026-08-01' },
        industries: ['Climate', 'Fintech'],
        geographies: ['Remote', 'US'],
        languages: ['English', 'Spanish'],
        privateNotes: 'E2E private helper note: only warm handoffs.',
      },
      { supabase: client },
    );

    expect(result).toMatchObject({ ok: true, capability: { id: 'e2e-helper-capability-001' } });
    expect(upserts[0]).toMatchObject({
      identity_id: 'e2e-helper-identity',
      categories: ['resume_review', 'network_introduction'],
      availability_status: 'limited',
      weekly_intro_capacity: 2,
      industries: ['Climate', 'Fintech'],
      geographies: ['Remote', 'US'],
      languages: ['English', 'Spanish'],
      private_notes: 'E2E private helper note: only warm handoffs.',
    });
    expect(auditEvents).toHaveLength(1);
  });

  it('keeps helper private notes out of public and unauthorized surfaces', async () => {
    const privateNote = 'E2E private helper note: only warm handoffs.';
    const publicCapability = serializePersistedHelperCapabilityForPublic(
      mapHelperCapabilityRow(deterministicHelperRow({ private_notes: privateNote })),
    );
    const { client, upserts } = createE2EHelperClient({ user: null, identity: null });

    expect(JSON.stringify(publicCapability)).not.toContain(privateNote);
    await expect(
      upsertHelperCapabilityAction({ categories: ['resume_review'], privateNotes: privateNote }, { supabase: client }),
    ).resolves.toMatchObject({ ok: false, error: 'auth_required' });
    expect(JSON.stringify(upserts)).not.toContain(privateNote);
  });

  it('does not persist invalid helper capability submissions', async () => {
    const { client, upserts, auditEvents } = createE2EHelperClient();

    await expect(
      upsertHelperCapabilityAction(
        { categories: [], availability: { status: 'available', weeklyIntroCapacity: 0 } },
        { supabase: client },
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: 'validation',
      errors: ['Select at least one helper capability category.'],
    });
    expect(upserts).toEqual([]);
    expect(auditEvents).toEqual([]);
  });
});
