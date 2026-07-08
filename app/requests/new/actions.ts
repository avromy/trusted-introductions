'use server';

import { redirect } from 'next/navigation';

import { requireCurrentUser, type SupabaseAuthClient } from '@/lib/auth/session';
import {
  normalizeJobSeekerRequestInput,
  validateJobSeekerRequestInput,
} from '@/lib/matching/job-seeker';
import { createClient } from '@/lib/supabase/server';
import type { JobSeekerRequestInput } from '@/types/matching';

type ActionSupabaseClient = {
  auth: SupabaseAuthClient['auth'];
  from(table: string): any;
};

type TrustedIdentityRow = { id: string; user_id: string | null; status: string };

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function requestRedirect(params: Record<string, string>): never {
  redirect(`/requests/new?${new URLSearchParams(params).toString()}`);
}

function safeMessage(error: unknown): string {
  if (error instanceof Error) {
    const expected = new Set([
      'A trusted identity is required to create a request.',
      'An active trusted identity is required to create a request.',
      'Unable to create job seeker request.',
    ]);

    if (expected.has(error.message)) {
      return error.message;
    }
  }

  return 'Unable to create your request right now. Please check the form and try again.';
}

async function requireTrustedIdentity(supabase: ActionSupabaseClient): Promise<TrustedIdentityRow> {
  const user = await requireCurrentUser(supabase);
  const { data, error } = await supabase
    .from('trusted_identities')
    .select('id,user_id,status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('A trusted identity is required to create a request.');
  if (data.status !== 'active')
    throw new Error('An active trusted identity is required to create a request.');

  return data;
}

export async function createJobSeekerRequestAction(formData: FormData): Promise<void> {
  const supabase = createClient() as unknown as ActionSupabaseClient;

  try {
    const identity = await requireTrustedIdentity(supabase);
    const input: JobSeekerRequestInput = {
      identityId: identity.id,
      headline: String(formData.get('headline') ?? ''),
      targetRole: String(formData.get('targetRole') ?? ''),
      targetCompanies: splitList(formData.get('targetCompanies')),
      targetLocations: splitList(formData.get('targetLocations')),
      remotePreference: String(formData.get('remotePreference') ?? ''),
      salaryExpectation: String(formData.get('salaryExpectation') ?? ''),
      workAuthorization: String(formData.get('workAuthorization') ?? ''),
      notes: String(formData.get('notes') ?? ''),
      resumeUrl: String(formData.get('resumeUrl') ?? ''),
      status: 'open',
    };
    const result = validateJobSeekerRequestInput(input);

    if (!result.valid) {
      requestRedirect({
        error: Object.values(result.errors).flat()[0] ?? 'Please check the form and try again.',
      });
    }

    const normalized = normalizeJobSeekerRequestInput(input);
    const now = new Date().toISOString();
    const { error } = await supabase.from('job_seeker_requests').insert({
      identity_id: normalized.identityId,
      status: normalized.status,
      headline: normalized.headline,
      target_role: normalized.targetRole,
      target_companies: normalized.targetCompanies,
      target_locations: normalized.targetLocations,
      remote_preference: normalized.remotePreference,
      salary_expectation: normalized.salaryExpectation,
      work_authorization: normalized.workAuthorization,
      notes: normalized.notes,
      resume_url: normalized.resumeUrl,
      opened_at: now,
    });

    if (error) throw error;
  } catch (error) {
    requestRedirect({ error: safeMessage(error) });
  }

  requestRedirect({ saved: '1' });
}
