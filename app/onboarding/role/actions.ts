'use server';

import { redirect } from 'next/navigation';
import { ZodError } from 'zod';

import { saveOnboardingRoleAction } from '@/lib/onboarding/actions';

function toMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? 'Choose how you expect to participate.';
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'We could not save your role yet. Please try again.';
}

export async function submitOnboardingRoleAction(formData: FormData): Promise<void> {
  try {
    await saveOnboardingRoleAction({
      role: 'member',
      contributionMode: String(formData.get('contributionMode') ?? ''),
    });
  } catch (error) {
    redirect(`/onboarding/role?error=${encodeURIComponent(toMessage(error))}`);
  }

  redirect('/onboarding/role?saved=1');
}
