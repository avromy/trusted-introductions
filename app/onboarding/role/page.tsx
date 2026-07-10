import React from 'react';
import { Card } from '@/components/ui';
import { calculateOnboardingProgress } from '@/lib/onboarding';
import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/supabase';
import { OnboardingShell } from '../_components/onboarding-shell';
import { onboardingSteps } from '../steps';
import { submitOnboardingRoleAction } from './actions';

type TrustedIdentityRow = Database['public']['Tables']['trusted_identities']['Row'];
type UserRoleRow = Database['public']['Tables']['user_roles']['Row'];
type InvitationRow = Database['public']['Tables']['invitations']['Row'];
type PrivacySettingsRow = Database['public']['Tables']['privacy_settings']['Row'];

type RolePageState = {
  identity: TrustedIdentityRow | null;
  roles: UserRoleRow[];
  contributionMode: string | null;
  invite: InvitationRow | null;
  privacySettings: PrivacySettingsRow | null;
  loadError: string | null;
};

const roleOptions = [
  {
    value: 'helper',
    label: 'Helper',
    eyebrow: 'Offer warm introductions',
    description:
      'Share context, referrals, or advice when you have a relevant relationship and consent to help.',
    outcomes: ['Be discoverable as a potential helper', 'Keep control over which requests you accept'],
  },
  {
    value: 'job_seeker',
    label: 'Job seeker',
    eyebrow: 'Ask for support',
    description:
      'Request trusted introductions, career advice, and company context from members who can help.',
    outcomes: ['Set up a profile for targeted asks', 'Make it clear what support would be useful'],
  },
  {
    value: 'both',
    label: 'Both',
    eyebrow: 'Give and receive help',
    description:
      'Use Trusted Introductions as a two-way network: ask for support when needed and help others when you can.',
    outcomes: ['Move through seeker and helper flows', 'Update your preference later as your needs change'],
  },
] as const;

function readContributionMode(metadata: Json): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const contributionMode = metadata.contributionMode ?? metadata.contribution_mode;

  return typeof contributionMode === 'string' && contributionMode.trim().length > 0
    ? contributionMode
    : null;
}

function formatValue(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function loadRolePageState(): Promise<RolePageState> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;

  if (userError) {
    return {
      identity: null,
      roles: [],
      contributionMode: null,
      invite: null,
      privacySettings: null,
      loadError:
        'We could not confirm your signed-in user yet. Refresh, then try saving again.',
    };
  }

  if (!user) {
    return {
      identity: null,
      roles: [],
      contributionMode: null,
      invite: null,
      privacySettings: null,
      loadError: null,
    };
  }

  const email = user.email?.toLowerCase() ?? null;
  const identityQuery = supabase
    .from('trusted_identities')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  const inviteQuery = email
    ? supabase
        .from('invitations')
        .select('*')
        .eq('invitee_email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [identityResult, inviteResult] = await Promise.all([identityQuery, inviteQuery]);
  const identity = identityResult.data as TrustedIdentityRow | null;
  const invite = inviteResult.data as InvitationRow | null;

  if (identityResult.error) {
    return {
      identity: null,
      roles: [],
      contributionMode: null,
      invite,
      privacySettings: null,
      loadError: 'We found your user but could not load onboarding identity state yet.',
    };
  }

  if (!identity) {
    return {
      identity: null,
      roles: [],
      contributionMode: null,
      invite,
      privacySettings: null,
      loadError: null,
    };
  }

  const [rolesResult, privacyResult] = await Promise.all([
    supabase
      .from('user_roles')
      .select('*')
      .eq('identity_id', identity.id)
      .order('created_at', { ascending: true }),
    supabase.from('privacy_settings').select('*').eq('identity_id', identity.id).maybeSingle(),
  ]);

  return {
    identity,
    roles: (rolesResult.data ?? []) as UserRoleRow[],
    contributionMode: readContributionMode(identity.metadata),
    invite,
    privacySettings: privacyResult.data as PrivacySettingsRow | null,
    loadError:
      rolesResult.error || privacyResult.error
        ? 'Some saved onboarding details could not be loaded. You can still choose and save your role.'
        : null,
  };
}

type RoleOnboardingPageProps = {
  searchParams?: Promise<{ saved?: string; error?: string }>;
};

export default async function RoleOnboardingPage({ searchParams }: RoleOnboardingPageProps) {
  const [state, params] = await Promise.all([loadRolePageState(), searchParams]);
  const currentRoles = state.roles.map((role) => role.role);
  const canSubmit = Boolean(state.identity && state.identity.status === 'active');
  const progress = calculateOnboardingProgress({
    invite: state.invite
      ? {
          status: state.invite.status === 'pending' ? 'pending' : 'redeemed',
          expiresAt: state.invite.expires_at ?? '',
        }
      : null,
    trustedIdentity: state.identity
      ? {
          id: state.identity.id,
          status: state.identity.status === 'active' ? 'active' : 'inactive',
          roles: currentRoles as never,
          contributionMode: state.contributionMode,
        }
      : null,
    profile: state.identity
      ? {
          id: state.identity.id,
          displayName: state.identity.display_name,
        }
      : null,
    privacySettings: state.privacySettings
      ? {
          profileVisibility:
            state.privacySettings.profile_visibility === 'private' ? 'private' : 'members',
          resumeVisibility:
            state.privacySettings.resume_visibility === 'private' ? 'private' : 'members',
          contactVisibility:
            state.privacySettings.contact_visibility === 'private' ? 'private' : 'members',
          publicMeetPageEnabled: state.privacySettings.public_meet_page_enabled,
          helperActivityVisible: true,
          allowAiSummary: state.privacySettings.allow_ai_summary,
        }
      : null,
  });
  const roleStatus = progress.checks.roleOrContributionModeComplete
    ? 'Complete'
    : 'Needs selection';

  return (
    <OnboardingShell
      badge="Contribution mode"
      title="Choose how you want to participate"
      description="Tell the community whether you want to help, seek help, or do both. We will save the member role and your contribution mode without changing the rest of onboarding."
      currentHref="/onboarding/role"
      steps={[...onboardingSteps]}
      previousHref="/onboarding/invite"
      previousLabel="Back to invite"
      nextHref="/onboarding/profile"
      nextLabel="Preview profile step"
    >
      <div className="space-y-5">
        <Card className="bg-cream p-5 shadow-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-trust/70">
                Current state
              </p>
              <h2 className="mt-2 text-xl font-bold text-ink">Your saved participation settings</h2>
            </div>
            <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-trust ring-1 ring-trust/15">
              {roleStatus}
            </span>
          </div>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-semibold text-ink">Saved role</dt>
              <dd className="mt-1 text-ink/70">
                {currentRoles.length ? currentRoles.map(formatValue).join(', ') : 'Not saved yet'}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Contribution mode</dt>
              <dd className="mt-1 text-ink/70">
                {state.contributionMode ? formatValue(state.contributionMode) : 'Not chosen yet'}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Next onboarding step</dt>
              <dd className="mt-1 text-ink/70">{formatValue(progress.step)}</dd>
            </div>
          </dl>
          {!state.identity ? (
            <p className="mt-4 rounded-2xl bg-white p-3 text-sm font-medium text-ink/70 ring-1 ring-black/5">
              Create or accept your invite first so we can attach this choice to your trusted identity.
            </p>
          ) : null}
          {state.identity && state.identity.status !== 'active' ? (
            <p className="mt-4 rounded-2xl bg-white p-3 text-sm font-medium text-rust ring-1 ring-rust/15">
              Your trusted identity is not active yet, so role preferences cannot be saved.
            </p>
          ) : null}
          {state.loadError ? (
            <p className="mt-3 text-sm font-medium text-rust" role="alert">
              {state.loadError}
            </p>
          ) : null}
          {params?.saved === '1' ? (
            <p className="mt-3 text-sm font-medium text-trust" role="status">
              Your role preferences were saved.
            </p>
          ) : null}
          {params?.error ? (
            <p className="mt-3 text-sm font-medium text-rust" role="alert">
              {params.error}
            </p>
          ) : null}
        </Card>

        <form action={submitOnboardingRoleAction} className="space-y-4" aria-describedby="role-help">
          <div id="role-help" className="rounded-3xl bg-sage/40 p-5 text-sm leading-6 text-ink/75">
            Pick the mode that best matches your current intent. Helper means you are open to
            assisting others, job seeker means you expect to request introductions or career help,
            and both keeps both paths open.
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {roleOptions.map((role) => {
              const selected = state.contributionMode === role.value;

              return (
                <Card key={role.value} className="bg-cream p-5 shadow-none">
                  <label className="flex h-full cursor-pointer flex-col gap-4">
                    <input
                      type="radio"
                      name="contributionMode"
                      value={role.value}
                      defaultChecked={selected}
                      className="sr-only peer"
                      required
                      disabled={!canSubmit}
                    />
                    <span>
                      <span className="block text-xs font-bold uppercase tracking-[0.18em] text-trust/70">
                        {role.eyebrow}
                      </span>
                      <span className="mt-2 block text-lg font-bold text-ink">{role.label}</span>
                      <span className="mt-2 block text-sm leading-6 text-ink/65">
                        {role.description}
                      </span>
                    </span>
                    <span className="block space-y-2 text-xs leading-5 text-ink/60">
                      {role.outcomes.map((outcome) => (
                        <span key={outcome} className="block rounded-2xl bg-white px-3 py-2">
                          {outcome}
                        </span>
                      ))}
                    </span>
                    <span className="mt-auto block rounded-full bg-white px-3 py-2 text-center text-xs font-semibold text-ink/50 ring-1 ring-black/5 peer-checked:text-trust peer-checked:ring-trust/40 peer-disabled:cursor-not-allowed peer-disabled:opacity-60">
                      {selected ? 'Selected' : 'Select this mode'}
                    </span>
                  </label>
                </Card>
              );
            })}
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-full bg-trust px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-trust/90 disabled:cursor-not-allowed disabled:bg-ink/30"
          >
            Save role preferences
          </button>
        </form>
      </div>
    </OnboardingShell>
  );
}
