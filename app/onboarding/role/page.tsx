import { Card } from '@/components/ui';
import { calculateOnboardingProgress } from '@/lib/onboarding';
import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/supabase';
import { OnboardingShell } from '../_components/onboarding-shell';
import { onboardingSteps } from '../steps';

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
    label: 'Seeking support',
    description: 'For members who expect to request warm introductions or career help.',
  },
  {
    label: 'Offering help',
    description: 'For members who expect to share advice, referrals, or community access.',
  },
  {
    label: 'Both',
    description: 'For members who expect to ask for support and help others over time.',
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
        'We could not load your signed-in user yet. The controls below remain previews only.',
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
        ? 'Some onboarding details could not be loaded yet.'
        : null,
  };
}

export default async function RoleOnboardingPage() {
  const state = await loadRolePageState();
  const currentRoles = state.roles.map((role) => role.role);
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
      badge="Member role"
      title="Choose how you expect to participate"
      description="This step now reads your onboarding state so you can preview role and contribution status before role-saving actions are available."
      currentHref="/onboarding/role"
      steps={[...onboardingSteps]}
      previousHref="/onboarding/invite"
      previousLabel="Back to invite"
      nextHref="/onboarding/profile"
      nextLabel="Preview profile step"
    >
      <div className="space-y-5">
        <Card className="bg-cream p-5 shadow-none">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-trust/70">
            Current state
          </p>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-semibold text-ink">Role status</dt>
              <dd className="mt-1 text-ink/70">{roleStatus}</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Saved roles</dt>
              <dd className="mt-1 text-ink/70">
                {currentRoles.length ? currentRoles.map(formatValue).join(', ') : 'None yet'}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Contribution mode</dt>
              <dd className="mt-1 text-ink/70">
                {state.contributionMode ? formatValue(state.contributionMode) : 'None yet'}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-ink/65">
            Onboarding progress is currently{' '}
            <span className="font-semibold text-trust">{formatValue(progress.step)}</span>; this
            page does not redirect or save changes.
          </p>
          {state.loadError ? (
            <p className="mt-3 text-sm font-medium text-rust">{state.loadError}</p>
          ) : null}
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          {roleOptions.map((role) => (
            <Card key={role.label} className="bg-cream p-5 text-center shadow-none">
              <p className="text-sm font-semibold text-trust">{role.label}</p>
              <p className="mt-2 text-xs leading-5 text-ink/60">{role.description}</p>
              <p className="mt-4 rounded-full bg-white px-3 py-2 text-xs font-semibold text-ink/50 ring-1 ring-black/5">
                Placeholder only
              </p>
            </Card>
          ))}
        </div>
      </div>
    </OnboardingShell>
  );
}
