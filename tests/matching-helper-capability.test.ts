import { describe, expect, it } from 'vitest';

import {
  HELPER_CAPABILITY_CATEGORY_VALUES,
  createHelperCapability,
  getDefaultHelperCapabilityAvailability,
  isHelperAvailableForIntroduction,
  isHelperAvailabilityStatus,
  isHelperCapabilityCategory,
  normalizeHelperCapabilityAvailability,
  normalizeHelperCapabilityCategories,
  normalizeHelperCapabilityLabels,
  serializeHelperCapability,
  validateHelperCapabilityInput,
} from '@/lib/matching/helper-capability';

describe('helper capability model', () => {
  it('defines supported capability categories', () => {
    expect(HELPER_CAPABILITY_CATEGORY_VALUES).toEqual([
      'career_navigation',
      'resume_review',
      'interview_practice',
      'network_introduction',
      'industry_insight',
      'portfolio_review',
      'accountability',
      'resource_navigation',
    ]);
    expect(isHelperCapabilityCategory('resume_review')).toBe(true);
    expect(isHelperCapabilityCategory('unsupported')).toBe(false);
  });

  it('normalizes category input safely', () => {
    expect(
      normalizeHelperCapabilityCategories(['resume_review', 'unsupported', 'resume_review']),
    ).toEqual(['resume_review']);
    expect(normalizeHelperCapabilityCategories(null)).toEqual([]);
  });

  it('returns fresh default availability', () => {
    const first = getDefaultHelperCapabilityAvailability();
    const second = getDefaultHelperCapabilityAvailability();

    expect(first).toEqual({ status: 'limited', weeklyIntroCapacity: 1, nextAvailableAt: null });
    expect(first).not.toBe(second);
  });

  it('normalizes availability and clamps capacity', () => {
    expect(isHelperAvailabilityStatus('available')).toBe(true);
    expect(isHelperAvailabilityStatus('busy')).toBe(false);
    expect(
      normalizeHelperCapabilityAvailability({ status: 'available', weeklyIntroCapacity: 99 }),
    ).toEqual({
      status: 'available',
      weeklyIntroCapacity: 20,
      nextAvailableAt: null,
    });
    expect(
      normalizeHelperCapabilityAvailability({ status: 'available', weeklyIntroCapacity: 0 }).status,
    ).toBe('unavailable');
  });

  it('validates required categories and available capacity', () => {
    expect(validateHelperCapabilityInput({ categories: [] })).toContain(
      'Select at least one helper capability category.',
    );
    expect(
      validateHelperCapabilityInput({
        categories: ['resume_review'],
        availability: { status: 'available', weeklyIntroCapacity: 0 },
      }),
    ).toEqual([]);
    expect(
      validateHelperCapabilityInput({
        categories: ['resume_review'],
        availability: { nextAvailableAt: 'not-a-date' },
      }),
    ).toContain('Next available date must be a valid ISO date string.');
  });

  it('normalizes helper labels', () => {
    expect(normalizeHelperCapabilityLabels([' Fintech ', '', 'Fintech', 'Public sector'])).toEqual([
      'Fintech',
      'Public sector',
    ]);
  });

  it('creates a normalized helper capability', () => {
    expect(
      createHelperCapability({
        categories: ['network_introduction', 'invalid' as never],
        availability: {
          status: 'available',
          weeklyIntroCapacity: 2.8,
          nextAvailableAt: '2026-08-01',
        },
        industries: [' Climate '],
        privateNotes: '  Prefers warm intros  ',
      }),
    ).toEqual({
      categories: ['network_introduction'],
      availability: {
        status: 'available',
        weeklyIntroCapacity: 2,
        nextAvailableAt: '2026-08-01T00:00:00.000Z',
      },
      industries: ['Climate'],
      geographies: [],
      languages: [],
      privateNotes: 'Prefers warm intros',
    });
  });

  it('checks introduction availability', () => {
    expect(
      isHelperAvailableForIntroduction(createHelperCapability({ categories: ['resume_review'] })),
    ).toBe(true);
    expect(
      isHelperAvailableForIntroduction(
        createHelperCapability({
          categories: ['resume_review'],
          availability: { status: 'unavailable', weeklyIntroCapacity: 3 },
        }),
      ),
    ).toBe(false);
  });

  it('serializes without private notes and with copied arrays', () => {
    const capability = createHelperCapability({
      categories: ['resume_review'],
      industries: ['Tech'],
      privateNotes: 'Do not expose',
    });
    const serialized = serializeHelperCapability(capability);

    expect(serialized).toEqual({
      categories: ['resume_review'],
      availability: { status: 'limited', weeklyIntroCapacity: 1, nextAvailableAt: null },
      industries: ['Tech'],
      geographies: [],
      languages: [],
    });
    expect('privateNotes' in serialized).toBe(false);
    expect(serialized.categories).not.toBe(capability.categories);
  });
});
