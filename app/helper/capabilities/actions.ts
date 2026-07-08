'use server';

import {
  createHelperCapability,
  serializeHelperCapability,
  validateHelperCapabilityInput,
  type HelperAvailabilityStatus,
  type HelperCapabilityCategory,
} from '@/lib/matching/helper-capability';

function getString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function getList(formData: FormData, key: string): string[] {
  const values = formData.getAll(key).filter((value): value is string => typeof value === 'string');
  const expanded = values.flatMap((value) => value.split(','));
  return expanded.map((item) => item.trim()).filter(Boolean);
}

export async function createHelperCapabilitiesFromForm(formData: FormData) {
  const weeklyIntroCapacity = Number(getString(formData, 'weeklyIntroCapacity') ?? 1);
  const input = {
    categories: getList(formData, 'categories') as HelperCapabilityCategory[],
    availability: {
      status:
        (getString(formData, 'availabilityStatus') as HelperAvailabilityStatus | undefined) ??
        'limited',
      weeklyIntroCapacity,
      nextAvailableAt: getString(formData, 'nextAvailableAt') ?? null,
    },
    industries: getList(formData, 'industries'),
    geographies: getList(formData, 'geographies'),
    languages: getList(formData, 'languages'),
    privateNotes: getString(formData, 'privateNotes') ?? null,
  };
  const errors = validateHelperCapabilityInput(input);

  if (errors.length > 0) {
    return { ok: false, error: 'validation' as const, errors };
  }

  return { ok: true, capability: serializeHelperCapability(createHelperCapability(input)) };
}

export async function submitHelperCapabilities(formData: FormData): Promise<void> {
  await createHelperCapabilitiesFromForm(formData);
}
