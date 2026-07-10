import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HelperCapabilitiesPage from '@/app/helper/capabilities/page';
import { submitHelperCapabilities } from '@/app/helper/capabilities/actions';
import { readHelperCapabilitiesFormData } from '@/app/helper/capabilities/form-state';
import { upsertHelperCapabilityAction } from '@/lib/matching/helper-capability-actions';

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>();

  return {
    ...actual,
    useFormState: vi.fn((_action, initialState) => [initialState, '#']),
    useFormStatus: vi.fn(() => ({ pending: false })),
  };
});

vi.mock('@/lib/matching/helper-capability-actions', () => ({
  upsertHelperCapabilityAction: vi.fn(),
}));

const upsertHelperCapabilityActionMock = vi.mocked(upsertHelperCapabilityAction);

describe('helper capabilities page', () => {
  beforeEach(() => {
    upsertHelperCapabilityActionMock.mockReset();
  });

  it('renders production helper capability intake sections and private note treatment', () => {
    const markup = renderToStaticMarkup(<HelperCapabilitiesPage />);

    expect(markup).toContain('Describe how you can help');
    expect(markup).toContain('How you can help');
    expect(markup).toContain('Weekly intro capacity');
    expect(markup).toContain('Matching labels');
    expect(markup).toContain('Private steward notes');
    expect(markup).toContain('Private');
    expect(markup).toContain('not included in public helper capability output');
    expect(markup).toContain('Save helper capabilities');
  });

  it('parses category, availability, capacity, labels, and private notes fields', () => {
    const formData = new FormData();
    formData.append('categories', 'resume_review');
    formData.append('categories', 'network_introduction');
    formData.set('availabilityStatus', 'available');
    formData.set('weeklyIntroCapacity', '3');
    formData.set('nextAvailableAt', '2026-08-01');
    formData.set('industries', 'Climate, Fintech');
    formData.set('geographies', 'US, Remote');
    formData.set('languages', 'English, Spanish');
    formData.set('privateNotes', 'Only introduce me to warm referrals.');

    expect(readHelperCapabilitiesFormData(formData)).toEqual({
      categories: ['resume_review', 'network_introduction'],
      availability: {
        status: 'available',
        weeklyIntroCapacity: 3,
        nextAvailableAt: '2026-08-01',
      },
      industries: ['Climate', 'Fintech'],
      geographies: ['US', 'Remote'],
      languages: ['English', 'Spanish'],
      privateNotes: 'Only introduce me to warm referrals.',
    });
  });

  it('returns validation errors from the upsert action for display', async () => {
    upsertHelperCapabilityActionMock.mockResolvedValue({
      ok: false,
      error: 'validation',
      errors: ['Select at least one helper capability category.'],
    });

    const result = await submitHelperCapabilities(
      { ok: false, message: null, errors: [] },
      new FormData(),
    );

    expect(result).toEqual({
      ok: false,
      message: 'Please fix the highlighted helper capability details.',
      errors: ['Select at least one helper capability category.'],
    });
  });

  it('wires successful submissions to the persisted upsert action', async () => {
    upsertHelperCapabilityActionMock.mockResolvedValue({
      ok: true,
      capability: {
        id: 'capability-1',
        identityId: 'identity-1',
        categories: ['resume_review'],
        availability: { status: 'limited', weeklyIntroCapacity: 1, nextAvailableAt: null },
        industries: ['Climate'],
        geographies: [],
        languages: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    const formData = new FormData();
    formData.set('categories', 'resume_review');
    formData.set('availabilityStatus', 'limited');
    formData.set('weeklyIntroCapacity', '1');
    formData.set('industries', 'Climate');

    const result = await submitHelperCapabilities(
      { ok: false, message: null, errors: [] },
      formData,
    );

    expect(upsertHelperCapabilityActionMock).toHaveBeenCalledWith({
      categories: ['resume_review'],
      availability: { status: 'limited', weeklyIntroCapacity: 1, nextAvailableAt: null },
      industries: ['Climate'],
      geographies: [],
      languages: [],
      privateNotes: null,
    });
    expect(result).toEqual({
      ok: true,
      message: 'Helper capabilities saved. Stewards can now use these details for matching.',
      errors: [],
    });
  });
});
