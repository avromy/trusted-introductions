import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import NewJobSeekerRequestPage from '@/app/requests/new/page';
import { createJobSeekerRequestFromForm } from '@/app/requests/new/actions';
import { createJobSeekerRequestAction } from '@/lib/matching/job-seeker-actions';
import { createE2EJobSeekerClient } from './fixtures';

vi.mock('@/lib/matching/job-seeker-actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/matching/job-seeker-actions')>();
  return { ...actual, createJobSeekerRequestAction: vi.fn(actual.createJobSeekerRequestAction) };
});

describe('seeker request browser E2E coverage', () => {
  it('renders the authenticated seeker request creation surface with stable form fields', () => {
    const markup = renderToStaticMarkup(<NewJobSeekerRequestPage />);

    expect(markup).toContain('Request trusted introductions');
    expect(markup).toContain('Submit seeker request');
    expect(markup).toContain('name="headline"');
    expect(markup).toContain('name="targetRole"');
    expect(markup).toContain('name="notes"');
  });

  it('shows required-field validation without persisting a seeker request', async () => {
    const { client, insertedRequests, auditEvents } = createE2EJobSeekerClient();

    const result = await createJobSeekerRequestAction(
      { headline: '', targetRole: '', targetCompanies: [], targetLocations: [], status: 'open' },
      { supabase: client },
    );

    expect(result).toMatchObject({
      ok: false,
      error: 'validation',
      errors: { headline: ['Required.'], targetRole: ['Required.'] },
    });
    expect(insertedRequests).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it('persists a deterministic authenticated seeker request through the form action', async () => {
    const { client, insertedRequests, auditEvents } = createE2EJobSeekerClient();
    vi.mocked(createJobSeekerRequestAction).mockImplementationOnce((input) =>
      createJobSeekerRequestAction(input, { supabase: client }),
    );
    const formData = new FormData();
    formData.set('headline', ' E2E seeker requests product leadership introductions ');
    formData.set('targetRole', 'Senior Product Manager');
    formData.set('targetCompanies', 'Acme Robotics, Globex Climate');
    formData.set('targetLocations', 'Remote, New York');
    formData.set('remotePreference', 'Remote-first');
    formData.set('salaryExpectation', '$150k+');
    formData.set('workAuthorization', 'US citizen');
    formData.set('resumeUrl', 'https://example.com/e2e-seeker-resume.pdf');
    formData.set('notes', 'E2E steward-only seeker routing note');
    formData.set('status', 'open');

    const result = await createJobSeekerRequestFromForm(formData);

    expect(result).toMatchObject({ ok: true, request: { id: 'e2e-request-001', hasResume: true } });
    expect(insertedRequests[0]).toMatchObject({
      identity_id: 'e2e-seeker-identity',
      status: 'open',
      headline: 'E2E seeker requests product leadership introductions',
      target_role: 'Senior Product Manager',
      target_companies: ['Acme Robotics', 'Globex Climate'],
      target_locations: ['Remote', 'New York'],
    });
    expect(auditEvents).toHaveLength(1);
  });

  it('blocks unauthorized seeker request access before persistence', async () => {
    const { client, insertedRequests, auditEvents } = createE2EJobSeekerClient({
      user: null,
      identity: null,
    });

    await expect(
      createJobSeekerRequestAction({ headline: 'E2E blocked', targetRole: 'Designer' }, { supabase: client }),
    ).resolves.toMatchObject({ ok: false, error: 'auth_required' });
    expect(insertedRequests).toEqual([]);
    expect(auditEvents).toEqual([]);
  });
});
