'use server';

import { redirect } from 'next/navigation';

import { requireCurrentUser, type SupabaseAuthClient } from '@/lib/auth/session';
import {
  createHelperCapability,
  HELPER_CAPABILITY_CATEGORY_VALUES,
  HELPER_AVAILABILITY_STATUS_VALUES,
  validateHelperCapabilityInput,
  type HelperAvailabilityStatus,
  type HelperCapabilityCategory,
} from '@/lib/matching/helper-capability';
import { createClient } from '@/lib/supabase/server';

type ActionSupabaseClient = {
  auth: SupabaseAuthClient['auth'];
  from(table: string): any;
};

type TrustedIdentityRow = { id: string; user_id: string | null; status: string };

function capabilityRedirect(params: Record<string, string>): never {
  redirect(`/helper/capabilities?${new URLSearchParams(params).toString()}`);
}

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeMessage(error: unknown): string {
  if (error instanceof Error) {
    const expected = new Set([
      'A trusted identity is required to save helper capabilities.',
      'An active trusted identity is required to save helper capabilities.',
      'Unable to save helper capabilities.',
    ]);

    if (expected.has(error.message)) return error.message;
  }

  return 'Unable to save helper capabilities right now. Please check the form and try again.';
}

async function requireTrustedIdentity(supabase: ActionSupabaseClient): Promise<TrustedIdentityRow> {
  const user = await requireCurrentUser(supabase);
  const { data, error } = await supabase
    .from('trusted_identities')
    .select('id,user_id,status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('A trusted identity is required to save helper capabilities.');
  if (data.status !== 'active')
    throw new Error('An active trusted identity is required to save helper capabilities.');

  return data;
}

export async function saveHelperCapabilityAction(formData: FormData): Promise<void> {
  const supabase = createClient() as unknown as ActionSupabaseClient;

  try {
    const identity = await requireTrustedIdentity(supabase);
    const statusValue = String(formData.get('availabilityStatus') ?? 'limited');
    const status = (HELPER_AVAILABILITY_STATUS_VALUES as readonly string[]).includes(statusValue)
      ? (statusValue as HelperAvailabilityStatus)
      : 'limited';
    const categories = formData
      .getAll('categories')
      .map(String)
      .filter((value): value is HelperCapabilityCategory =>
        (HELPER_CAPABILITY_CATEGORY_VALUES as readonly string[]).includes(value),
      );
    const input = {
      categories,
      availability: {
        status,
        weeklyIntroCapacity: Number(formData.get('weeklyIntroCapacity') ?? 1),
        nextAvailableAt: String(formData.get('nextAvailableAt') ?? ''),
      },
      industries: splitList(formData.get('industries')),
      geographies: splitList(formData.get('geographies')),
      languages: splitList(formData.get('languages')),
      privateNotes: String(formData.get('privateNotes') ?? ''),
    };
    const errors = validateHelperCapabilityInput(input);

    if (errors.length > 0) {
      capabilityRedirect({ error: errors[0] });
    }

    const capability = createHelperCapability(input);
    const { error } = await supabase.from('helper_capabilities').upsert(
      {
        identity_id: identity.id,
        categories: capability.categories,
        availability_status: capability.availability.status,
        weekly_intro_capacity: capability.availability.weeklyIntroCapacity,
        next_available_at: capability.availability.nextAvailableAt,
        industries: capability.industries,
        geographies: capability.geographies,
        languages: capability.languages,
        private_notes: capability.privateNotes,
      },
      { onConflict: 'identity_id' },
    );

    if (error) throw error;
  } catch (error) {
    capabilityRedirect({ error: safeMessage(error) });
  }

  capabilityRedirect({ saved: '1' });
}
