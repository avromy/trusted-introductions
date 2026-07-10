import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NewJobSeekerRequestPage from '@/app/requests/new/page';

vi.mock('@/lib/matching/job-seeker-actions', () => ({
  createJobSeekerRequestAction: vi.fn(),
}));

describe('NewJobSeekerRequestPage', () => {
  it('renders production-ready sections and supported fields', () => {
    const html = renderToStaticMarkup(<NewJobSeekerRequestPage />);

    expect(html).toContain('Request trusted introductions');
    expect(html).toContain('Opportunity focus');
    expect(html).toContain('Intro targets');
    expect(html).toContain('Candidate context');
    expect(html).toContain('Notes for the steward');
    expect(html).toContain('name="headline"');
    expect(html).toContain('name="targetRole"');
    expect(html).toContain('name="targetCompanies"');
    expect(html).toContain('name="targetLocations"');
    expect(html).toContain('name="remotePreference"');
    expect(html).toContain('name="salaryExpectation"');
    expect(html).toContain('name="workAuthorization"');
    expect(html).toContain('name="resumeUrl"');
    expect(html).toContain('name="notes"');
    expect(html).toContain('name="status"');
  });
});

describe('job seeker request form actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns validation display state for invalid submissions', async () => {
    const { createJobSeekerRequestAction } = await import('@/lib/matching/job-seeker-actions');
    vi.mocked(createJobSeekerRequestAction).mockResolvedValueOnce({
      ok: false,
      error: 'validation',
      errors: {
        headline: ['Headline is required.'],
        targetRole: ['Target role is required.'],
      },
    });
    const { submitJobSeekerRequest } = await import('@/app/requests/new/actions');

    const result = await submitJobSeekerRequest({ ok: null }, new FormData());

    expect(result).toEqual({
      ok: false,
      error: 'validation',
      errors: {
        headline: ['Headline is required.'],
        targetRole: ['Target role is required.'],
      },
    });
    expect(createJobSeekerRequestAction).toHaveBeenCalledWith({
      headline: '',
      targetRole: '',
      targetCompanies: [],
      targetLocations: [],
      remotePreference: null,
      salaryExpectation: null,
      workAuthorization: null,
      notes: null,
      resumeUrl: null,
      status: 'open',
    });
  });

  it('wires supported form fields to the successful create action', async () => {
    const { createJobSeekerRequestAction } = await import('@/lib/matching/job-seeker-actions');
    vi.mocked(createJobSeekerRequestAction).mockResolvedValueOnce({
      ok: true,
      request: {
        id: 'request-1',
        status: 'open',
        headline: 'Seeking warm intros',
        targetRole: 'Senior Product Manager',
        targetCompanies: ['Acme', 'Globex'],
        targetLocations: ['Remote', 'New York'],
        remotePreference: 'Remote-first',
        hasResume: true,
        createdAt: '2026-07-09T00:00:00.000Z',
        updatedAt: '2026-07-09T00:00:00.000Z',
      },
    });
    const { submitJobSeekerRequest } = await import('@/app/requests/new/actions');
    const formData = new FormData();
    formData.set('headline', ' Seeking warm intros ');
    formData.set('targetRole', 'Senior Product Manager');
    formData.set('targetCompanies', 'Acme, Globex');
    formData.set('targetLocations', 'Remote, New York');
    formData.set('remotePreference', 'Remote-first');
    formData.set('salaryExpectation', '$140k+');
    formData.set('workAuthorization', 'US citizen');
    formData.set('resumeUrl', 'https://example.com/resume.pdf');
    formData.set('notes', 'Prioritize marketplace companies.');
    formData.set('status', 'open');

    const result = await submitJobSeekerRequest({ ok: null }, formData);

    expect(result).toMatchObject({ ok: true, request: { id: 'request-1' } });
    expect(createJobSeekerRequestAction).toHaveBeenCalledWith({
      headline: 'Seeking warm intros',
      targetRole: 'Senior Product Manager',
      targetCompanies: ['Acme', 'Globex'],
      targetLocations: ['Remote', 'New York'],
      remotePreference: 'Remote-first',
      salaryExpectation: '$140k+',
      workAuthorization: 'US citizen',
      notes: 'Prioritize marketplace companies.',
      resumeUrl: 'https://example.com/resume.pdf',
      status: 'open',
    });
  });
});
