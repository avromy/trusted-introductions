import { createAuditEventPayload, insertAuditEvent } from '@/lib/audit';
import { requireCurrentIdentity } from '@/lib/auth/session';
import { createPrivacySettingsUpsertPayload, getDefaultPrivacySettings } from '@/lib/privacy';
import { createClient } from '@/lib/supabase/server';

import type { AuthIdentity, SupabaseAuthClient } from '@/lib/auth/session';
import type { PrivacySettings, ProfileVisibility, SensitiveFieldVisibility } from '@/types/privacy';
import type { Database } from '@/types/supabase';

const PROFILE_VISIBILITY_VALUES = ['private', 'members', 'public'] as const;
const SENSITIVE_FIELD_VISIBILITY_VALUES = [
  'private',
  'introduction',
  'helpers',
  'members',
  'public',
] as const;

export type SavePrivacySettingsInput = Partial<PrivacySettings> | null | undefined;

export type SavePrivacySettingsActionResult =
  | { ok: true; settings: PrivacySettings }
  | { ok: false; error: string; settings: PrivacySettings };

type PrivacySettingsMutationClient = SupabaseAuthClient & {
  from(table: 'audit_events'): {
    insert(payload: import('@/types/audit').AuditEventPayload): Promise<{ error: Error | null }>;
  };
  from(table: 'privacy_settings'): {
    upsert(
      payload: {
        identity_id: string;
        profile_visibility: Database['public']['Enums']['privacy_visibility'];
        resume_visibility: Database['public']['Enums']['privacy_visibility'];
        contact_visibility: Database['public']['Enums']['privacy_visibility'];
        public_meet_page_enabled: boolean;
        allow_ai_summary: boolean;
      },
      options: { onConflict: 'identity_id' },
    ): Promise<{ error: Error | null }>;
  };
};

function isProfileVisibility(value: unknown): value is ProfileVisibility {
  return PROFILE_VISIBILITY_VALUES.includes(value as ProfileVisibility);
}

function isSensitiveFieldVisibility(value: unknown): value is SensitiveFieldVisibility {
  return SENSITIVE_FIELD_VISIBILITY_VALUES.includes(value as SensitiveFieldVisibility);
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function trustedIdentityId(identity: AuthIdentity): string | null {
  const id = identity.id ?? identity.identity_id ?? identity.user_id;

  return typeof id === 'string' && id.trim().length > 0 ? id : null;
}

function normalizePrivacySettings(input: SavePrivacySettingsInput): {
  settings: PrivacySettings;
  error: string | null;
} {
  const defaults = getDefaultPrivacySettings();

  if (!input) {
    return { settings: defaults, error: null };
  }

  if (
    input.profileVisibility !== undefined &&
    !isProfileVisibility(input.profileVisibility)
  ) {
    return { settings: defaults, error: 'Invalid profile visibility value.' };
  }

  if (input.resumeVisibility !== undefined && !isSensitiveFieldVisibility(input.resumeVisibility)) {
    return { settings: defaults, error: 'Invalid resume visibility value.' };
  }

  if (input.contactVisibility !== undefined && !isSensitiveFieldVisibility(input.contactVisibility)) {
    return { settings: defaults, error: 'Invalid contact visibility value.' };
  }

  return {
    settings: {
      profileVisibility: input.profileVisibility ?? defaults.profileVisibility,
      resumeVisibility: input.resumeVisibility ?? defaults.resumeVisibility,
      contactVisibility: input.contactVisibility ?? defaults.contactVisibility,
      publicMeetPageEnabled: coerceBoolean(
        input.publicMeetPageEnabled,
        defaults.publicMeetPageEnabled,
      ),
      helperActivityVisible: coerceBoolean(
        input.helperActivityVisible,
        defaults.helperActivityVisible,
      ),
      allowAiSummary: coerceBoolean(input.allowAiSummary, defaults.allowAiSummary),
    },
    error: null,
  };
}

export async function savePrivacySettingsAction(
  input: SavePrivacySettingsInput,
): Promise<SavePrivacySettingsActionResult> {
  'use server';

  const normalized = normalizePrivacySettings(input);

  if (normalized.error) {
    return { ok: false, error: normalized.error, settings: normalized.settings };
  }

  const supabase = createClient() as unknown as PrivacySettingsMutationClient;
  const identity = await requireCurrentIdentity(supabase);
  const identityId = trustedIdentityId(identity);

  if (!identityId) {
    return {
      ok: false,
      error: 'A trusted identity id is required.',
      settings: getDefaultPrivacySettings(),
    };
  }

  const now = new Date().toISOString();
  const { settings } = normalized;
  const { error } = await supabase.from('privacy_settings').upsert(
    createPrivacySettingsUpsertPayload(identityId, settings),
    { onConflict: 'identity_id' },
  );

  if (error) {
    throw error;
  }

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'privacy_settings.updated',
      actor: { type: 'user', id: identityId },
      target: { type: 'trusted_identity', id: identityId },
      metadata: { settings },
      occurredAt: now,
    }),
  );

  return { ok: true, settings };
}
