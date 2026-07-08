import { getDefaultPrivacySettings, mapPrivacySettingsRow } from '@/lib/privacy';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';
import { OnboardingShell } from '../_components/onboarding-shell';
import { onboardingSteps } from '../steps';
import { PrivacySettingsForm } from './privacy-settings-form';

type PrivacySettingsRow = Database['public']['Tables']['privacy_settings']['Row'];

async function loadPrivacySettings() {
  const defaults = getDefaultPrivacySettings();
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return { settings: defaults, loadError: null };
  }

  const identityResult = await supabase
    .from('trusted_identities')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (identityResult.error) {
    return { settings: defaults, loadError: 'We could not load your identity yet.' };
  }

  const identity = identityResult.data as { id: string } | null;

  if (!identity) {
    return { settings: defaults, loadError: null };
  }

  const privacyResult = await supabase
    .from('privacy_settings')
    .select('*')
    .eq('identity_id', identity.id)
    .maybeSingle();

  if (privacyResult.error) {
    return { settings: defaults, loadError: 'We could not load saved privacy settings yet.' };
  }

  return {
    settings: privacyResult.data
      ? mapPrivacySettingsRow(privacyResult.data as PrivacySettingsRow)
      : defaults,
    loadError: null,
  };
}

export default async function PrivacyOnboardingPage() {
  const { settings, loadError } = await loadPrivacySettings();

  return (
    <OnboardingShell
      badge="Privacy controls"
      title="Set expectations before anything is shared"
      description="Choose what members can see before introductions are requested. You can keep everything private and update these settings later."
      currentHref="/onboarding/privacy"
      steps={[...onboardingSteps]}
      previousHref="/onboarding/profile"
      previousLabel="Back to profile"
      nextHref="/onboarding/complete"
      nextLabel="Preview completion"
    >
      <div className="space-y-4">
        {loadError ? <p className="text-sm font-semibold text-rust">{loadError}</p> : null}
        <PrivacySettingsForm settings={settings} />
      </div>
    </OnboardingShell>
  );
}
