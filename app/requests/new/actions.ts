'use server';

import { createJobSeekerRequestAction } from '@/lib/matching/job-seeker-actions';
import type { JobSeekerRequestStatus } from '@/types/matching';

function getString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function getList(formData: FormData, key: string): string[] {
  const value = getString(formData, key);
  return (
    value
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}

export async function createJobSeekerRequestFromForm(formData: FormData) {
  return createJobSeekerRequestAction({
    headline: getString(formData, 'headline') ?? '',
    targetRole: getString(formData, 'targetRole') ?? '',
    targetCompanies: getList(formData, 'targetCompanies'),
    targetLocations: getList(formData, 'targetLocations'),
    remotePreference: getString(formData, 'remotePreference') ?? null,
    salaryExpectation: getString(formData, 'salaryExpectation') ?? null,
    workAuthorization: getString(formData, 'workAuthorization') ?? null,
    notes: getString(formData, 'notes') ?? null,
    resumeUrl: getString(formData, 'resumeUrl') ?? null,
    status: (getString(formData, 'status') as JobSeekerRequestStatus | undefined) ?? 'open',
  });
}

export async function submitJobSeekerRequest(formData: FormData): Promise<void> {
  await createJobSeekerRequestFromForm(formData);
}
