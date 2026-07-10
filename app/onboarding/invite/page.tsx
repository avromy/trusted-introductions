import React from 'react';
import { createClient as createServiceClient } from '@supabase/supabase-js';

import { Card } from '@/components/ui';
import { getEnv } from '@/lib/env';
import { hashInviteToken, validateInviteForRedemption } from '@/lib/invites';
import { createClient } from '@/lib/supabase/server';
import type { SafeInviteValidationResult } from '@/lib/invites';
import type { Database } from '@/types/supabase';
import type { User } from '@supabase/supabase-js';

import { OnboardingShell } from '../_components/onboarding-shell';
import { onboardingSteps } from '../steps';

type InviteSearchParams = {
  token?: string | string[];
};

type InvitePageState =
  | SafeInviteValidationResult
  | {
      valid: false;
      reason: 'missing' | 'unavailable' | 'unauthenticated';
    };

type InviteStateCopyKey = Exclude<InvitePageState, { valid: true }>['reason'] | 'valid';

const inviteStateCopy: Record<
  InviteStateCopyKey,
  { eyebrow: string; title: string; body: string; guidance: string }
> = {
  valid: {
    eyebrow: 'Invitation found',
    title: 'Your trusted invitation is ready',
    body: 'You are signed in and this invite is ready to continue. We will confirm your onboarding details before granting community access.',
    guidance: 'Continue to choose how you want to participate in this trusted community.',
  },
  missing: {
    eyebrow: 'Invitation needed',
    title: 'Open this page from your invite link',
    body: 'This page needs the secure token from your invitation email or message before we can continue.',
    guidance:
      'Open the original invite link, or ask your trusted contact to send a fresh invitation.',
  },
  token_mismatch: {
    eyebrow: 'Invitation not found',
    title: 'This invite link is not valid',
    body: 'The token in this link does not match an active invitation. Nothing has been changed on your account.',
    guidance: 'Check that the full link was copied correctly, or request a new invitation.',
  },
  expired: {
    eyebrow: 'Invitation expired',
    title: 'This invite link has expired',
    body: 'For safety, invitations stop working after their expiration date. This link can no longer be accepted.',
    guidance: 'Ask your trusted contact to send a new invitation if you still need access.',
  },
  revoked: {
    eyebrow: 'Invitation revoked',
    title: 'This invite is no longer available',
    body: 'The person or team that issued this invitation has withdrawn it. Revoked invitations cannot be accepted.',
    guidance: 'Contact your trusted inviter if you believe access is still intended.',
  },
  redeemed: {
    eyebrow: 'Invitation already used',
    title: 'This invite has already been redeemed',
    body: 'This invitation has already been accepted. Invite links can only be redeemed one time.',
    guidance:
      'Sign in with the account that accepted it, or ask for a new invitation if you need to use a different account.',
  },
  blocked: {
    eyebrow: 'Invitation unavailable',
    title: 'This invite is not available',
    body: 'This invitation is blocked and cannot be used. No onboarding or community access changes were made.',
    guidance:
      'Ask your trusted contact to review the invitation and send a new one if appropriate.',
  },
  unauthenticated: {
    eyebrow: 'Sign in required',
    title: 'Sign in to accept this invitation',
    body: 'This invite is valid, but you need to be signed in before you can continue onboarding.',
    guidance:
      'Sign in with the email address that received the invite, then reopen this link to continue.',
  },
  unavailable: {
    eyebrow: 'Validation unavailable',
    title: 'We could not validate this invite',
    body: 'We could not safely validate this invitation right now. No onboarding or community access changes were made.',
    guidance: 'Please try again later, or ask your trusted contact to confirm the invitation.',
  },
};

function readToken(searchParams?: InviteSearchParams): string | null {
  const token = searchParams?.token;
  const tokenValue = Array.isArray(token) ? token[0] : token;
  const trimmedToken = tokenValue?.trim();

  return trimmedToken ? trimmedToken : null;
}

function createInviteLookupClient() {
  const env = getEnv();

  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    return createServiceClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false },
      },
    );
  }

  return createClient();
}

async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
}

async function validateInviteToken(token: string | null): Promise<InvitePageState> {
  if (token === null) {
    return { valid: false, reason: 'missing' };
  }

  const supabase = createInviteLookupClient();
  const { data: invite, error } = await supabase
    .from('invitations')
    .select(
      'id, invitee_email, community_id, expires_at, redeemed_at, redemption_status, status, token_hash',
    )
    .eq('token_hash', hashInviteToken(token))
    .maybeSingle();

  if (error) {
    return { valid: false, reason: 'unavailable' };
  }

  if (invite === null) {
    return { valid: false, reason: 'token_mismatch' };
  }

  return validateInviteForRedemption({ invite, token });
}

export default async function InviteOnboardingPage({
  searchParams,
}: {
  searchParams?: InviteSearchParams;
}) {
  const inviteState = await validateInviteToken(readToken(searchParams));
  const currentUser = inviteState.valid ? await getCurrentUser() : null;
  const pageState: InvitePageState =
    inviteState.valid && currentUser === null
      ? { valid: false, reason: 'unauthenticated' }
      : inviteState;
  const copy = pageState.valid ? inviteStateCopy.valid : inviteStateCopy[pageState.reason];

  return (
    <OnboardingShell
      badge="Invitation"
      title="Start with a trusted invitation"
      description="Review your invitation status and sign in before we continue account setup or community access."
      currentHref="/onboarding/invite"
      steps={[...onboardingSteps]}
      nextHref={pageState.valid ? '/onboarding/role' : undefined}
      nextLabel={pageState.valid ? 'Continue onboarding' : undefined}
    >
      <Card className="bg-cream p-5 shadow-none">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-trust">
          {copy.eyebrow}
        </p>
        <h2 className="mt-3 text-lg font-semibold text-ink">{copy.title}</h2>
        <p className="mt-3 text-sm leading-6 text-ink/70">{copy.body}</p>
        <p className="mt-3 text-sm font-medium leading-6 text-ink">{copy.guidance}</p>
        {pageState.valid ? (
          <p className="mt-4 text-sm leading-6 text-ink/70">
            This invite is for{' '}
            <span className="font-medium text-ink">{pageState.invite.inviteeEmail}</span>
            {pageState.invite.expiresAt
              ? ` and expires on ${new Date(pageState.invite.expiresAt).toLocaleDateString('en-US')}`
              : ''}
            .
          </p>
        ) : null}
      </Card>
    </OnboardingShell>
  );
}
