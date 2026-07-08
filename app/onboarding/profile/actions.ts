'use server';

import { redirect } from 'next/navigation';
import { ZodError } from 'zod';

import { saveOnboardingProfileAction } from '@/lib/profiles/actions';

function profileRedirect(params: Record<string, string>): never {
  const searchParams = new URLSearchParams(params);
  redirect(`/onboarding/profile?${searchParams.toString()}`);
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? 'Please check your profile details and try again.';
  }

  if (error instanceof Error) {
    const expectedMessages = new Set([
      'A trusted identity is required to set up a profile.',
      'An active trusted identity is required to set up a profile.',
      'Unable to save onboarding profile.',
    ]);

    if (expectedMessages.has(error.message)) {
      return error.message;
    }
  }

  return 'Unable to save your profile right now. Please try again.';
}

export async function submitOnboardingProfile(formData: FormData): Promise<void> {
  try {
    await saveOnboardingProfileAction({
      displayName: String(formData.get('displayName') ?? ''),
      headline: String(formData.get('headline') ?? ''),
      summary: String(formData.get('summary') ?? ''),
      location: String(formData.get('location') ?? ''),
    });
  } catch (error) {
    profileRedirect({ error: safeErrorMessage(error) });
  }

  profileRedirect({ saved: '1' });
}
