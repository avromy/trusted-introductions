'use server';

import { upsertHelperCapabilityAction } from '@/lib/matching/helper-capability-actions';
import { readHelperCapabilitiesFormData, type HelperCapabilitiesFormState } from './form-state';

export async function submitHelperCapabilities(
  _previousState: HelperCapabilitiesFormState,
  formData: FormData,
): Promise<HelperCapabilitiesFormState> {
  const result = await upsertHelperCapabilityAction(readHelperCapabilitiesFormData(formData));

  if (!result.ok) {
    if (result.error === 'validation') {
      return {
        ok: false,
        message: 'Please fix the highlighted helper capability details.',
        errors: result.errors,
      };
    }

    return { ok: false, message: result.message, errors: [] };
  }

  return {
    ok: true,
    message: 'Helper capabilities saved. Stewards can now use these details for matching.',
    errors: [],
  };
}
