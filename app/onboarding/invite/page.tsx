import { createClient as createServiceClient } from '@supabase/supabase-js';

import { Card } from '@/components/ui';
import { getEnv } from '@/lib/env';
import { hashInviteToken, validateInviteForRedemption } from '@/lib/invites';
import { createClient } from '@/lib/supabase/server';
import type { SafeInviteValidationResult } from '@/lib/invites';
import type { Database } from '@/types/supabase';

import { OnboardingShell } from '../_components/onboarding-shell';
import { onboardingSteps } from '../steps';

type InviteSearchParams = {
  token?: string | string[];
};

type InvitePageState =
  | SafeInviteValidationResult
  | {
      valid: false;
      reason: 'missing' | 'unavailable';
    };

type InviteStateCopyKey = Exclude<InvitePageState, { valid: true }>['reason'] | 'valid';

const inviteStateCopy: Record<
  InviteStateCopyKey,
  { eyebrow: string; title: string; body: string }
> = {
  valid: {
    eyebrow: 'Invitation found',
    title: 'Your trusted invitation is ready',
    body: 'This invitation looks valid. Redemption is not enabled on this page yet, so no account, profile, or community access changes have been made.',
  },
  missing: {
    eyebrow: 'Invitation needed',
    title: 'Open this page from your invite link',
    body: 'We could not find an invite token in the link. Ask your trusted contact to resend the invitation before continuing.',
  },
  token_mismatch: {
    eyebrow: 'Invitation not found',
    title: 'This invite link is not valid',
    body: 'The token in this link does not match an active invitation. Check that the full link was copied correctly or request a new one.',
  },
  expired: {
    eyebrow: 'Invitation expired',
    title: 'This invite link has expired',
    body: 'For safety, expired invitations cannot be used. Ask your trusted contact to send a fresh invitation.',
  },
  revoked: {
    eyebrow: 'Invitation revoked',
    title: 'This invite is no longer available',
    body: 'The invitation was revoked before it could be used. Contact the person who invited you if you think this was a mistake.',
  },
  redeemed: {
    eyebrow: 'Invitation already used',
    title: 'This invite has already been redeemed',
    body: 'Invite links can only be used once. Sign in with the account that accepted it or ask for a new invitation.',
  },
  blocked: {
    eyebrow: 'Invitation unavailable',
    title: 'This invite is not available',
    body: 'This invitation is blocked and cannot be used. Ask your trusted contact to send a new invitation if access is still intended.',
  },
  unavailable: {
    eyebrow: 'Validation unavailable',
    title: 'We could not validate this invite',
    body: 'No changes were made. Please try again later or ask your trusted contact to confirm the invitation.',
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
  const copy = inviteState.valid ? inviteStateCopy.valid : inviteStateCopy[inviteState.reason];

  return (
    <OnboardingShell
      badge="Invitation"
      title="Start with a trusted invitation"
      description="Confirm that your invite link is still usable before any account setup or community access happens."
      currentHref="/onboarding/invite"
      steps={[...onboardingSteps]}
      nextHref="/onboarding/role"
      nextLabel="Preview role step"
    >
      <Card className="bg-cream p-5 shadow-none">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-trust">
          {copy.eyebrow}
        </p>
        <h2 className="mt-3 text-lg font-semibold text-ink">{copy.title}</h2>
        <p className="mt-3 text-sm leading-6 text-ink/70">{copy.body}</p>
        {inviteState.valid ? (
          <p className="mt-4 text-sm leading-6 text-ink/70">
            This invite is for{' '}
            <span className="font-medium text-ink">{inviteState.invite.inviteeEmail}</span>
            {inviteState.invite.expiresAt
              ? ` and expires on ${new Date(inviteState.invite.expiresAt).toLocaleDateString('en-US')}`
              : ''}
            .
          </p>
        ) : null}
      </Card>
    </OnboardingShell>
  );
}
