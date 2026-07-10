import type {
  HelperAvailabilityStatus,
  HelperCapabilityCategory,
  HelperCapabilityInput,
} from '@/lib/matching/helper-capability';

export type HelperCapabilitiesFormState = {
  ok: boolean;
  message: string | null;
  errors: string[];
};

export const initialHelperCapabilitiesFormState: HelperCapabilitiesFormState = {
  ok: false,
  message: null,
  errors: [],
};

function getString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function getList(formData: FormData, key: string): string[] {
  const values = formData.getAll(key).filter((value): value is string => typeof value === 'string');
  const expanded = values.flatMap((value) => value.split(','));
  return expanded.map((item) => item.trim()).filter(Boolean);
}

export function readHelperCapabilitiesFormData(formData: FormData): HelperCapabilityInput {
  const capacityValue = getString(formData, 'weeklyIntroCapacity');

  return {
    categories: getList(formData, 'categories') as HelperCapabilityCategory[],
    availability: {
      status:
        (getString(formData, 'availabilityStatus') as HelperAvailabilityStatus | undefined) ??
        'limited',
      weeklyIntroCapacity: capacityValue ? Number(capacityValue) : 1,
      nextAvailableAt: getString(formData, 'nextAvailableAt') ?? null,
    },
    industries: getList(formData, 'industries'),
    geographies: getList(formData, 'geographies'),
    languages: getList(formData, 'languages'),
    privateNotes: getString(formData, 'privateNotes') ?? null,
  };
}
