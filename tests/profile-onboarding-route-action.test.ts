import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRedirect = vi.hoisted(() =>
  vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
);
const mockSaveOnboardingProfileAction = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

vi.mock('@/lib/profiles/actions', () => ({
  saveOnboardingProfileAction: mockSaveOnboardingProfileAction,
}));

import { submitOnboardingProfile } from '@/app/onboarding/profile/actions';

function createFormData(values: Record<string, string>) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

describe('submitOnboardingProfile', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
    mockSaveOnboardingProfileAction.mockReset();
  });

  it('preserves successful profile persistence and redirects with saved state', async () => {
    mockSaveOnboardingProfileAction.mockResolvedValueOnce({ profile: { id: 'profile-123' } });

    await expect(
      submitOnboardingProfile(
        createFormData({
          displayName: 'Ada Lovelace',
          headline: 'Building trustworthy introductions',
          summary: 'I help members find warm, relevant connections.',
          location: 'London',
        }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding/profile?saved=1');

    expect(mockSaveOnboardingProfileAction).toHaveBeenCalledWith({
      displayName: 'Ada Lovelace',
      headline: 'Building trustworthy introductions',
      summary: 'I help members find warm, relevant connections.',
      location: 'London',
    });
    expect(mockRedirect).toHaveBeenCalledWith('/onboarding/profile?saved=1');
  });

  it('preserves validation failures and redirects with a safe error state', async () => {
    mockSaveOnboardingProfileAction.mockRejectedValueOnce(
      new Error('Display name must be at least 2 characters.'),
    );

    await expect(
      submitOnboardingProfile(
        createFormData({ displayName: 'A', headline: '', summary: '', location: '' }),
      ),
    ).rejects.toThrow(
      'NEXT_REDIRECT:/onboarding/profile?error=Unable+to+save+your+profile+right+now.+Please+try+again.',
    );

    expect(mockSaveOnboardingProfileAction).toHaveBeenCalledWith({
      displayName: 'A',
      headline: '',
      summary: '',
      location: '',
    });
  });
});
