import { describe, expect, it, vi } from 'vitest';

import {
  createPrivacySettingsUpsertPayload,
  ensureDefaultPrivacySettings,
  getDefaultPrivacySettings,
  getPrivacySettingsByIdentityId,
  upsertPrivacySettings,
} from '@/lib/privacy';
import type { PrivacySettingsSupabaseClient } from '@/lib/privacy';
import type { Database } from '@/types/supabase';

type PrivacySettingsRow = Database['public']['Tables']['privacy_settings']['Row'];

const IDENTITY_ID = 'identity-123';

function privacySettingsRow(overrides: Partial<PrivacySettingsRow> = {}): PrivacySettingsRow {
  return {
    id: 'privacy-settings-123',
    identity_id: IDENTITY_ID,
    profile_visibility: 'private',
    contact_visibility: 'private',
    resume_visibility: 'private',
    allow_ai_summary: false,
    helper_activity_visible: false,
    public_meet_page_enabled: false,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function createSupabaseMock(
  options: {
    maybeSingleData?: PrivacySettingsRow | null;
    maybeSingleError?: Error | null;
    singleData?: PrivacySettingsRow | null;
    singleError?: Error | null;
  } = {},
) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options.maybeSingleData ?? null,
    error: options.maybeSingleError ?? null,
  });
  const single = vi.fn().mockResolvedValue({
    data: options.singleData ?? privacySettingsRow(),
    error: options.singleError ?? null,
  });
  const selectAfterUpsert = vi.fn(() => ({ single }));
  const upsert = vi.fn(() => ({ select: selectAfterUpsert }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select, upsert }));

  return {
    supabase: { from } as unknown as PrivacySettingsSupabaseClient,
    calls: { eq, from, maybeSingle, select, selectAfterUpsert, single, upsert },
  };
}

describe('privacy repository helpers', () => {
  it('gets privacy settings by identity id', async () => {
    const { supabase, calls } = createSupabaseMock({
      maybeSingleData: privacySettingsRow({
        profile_visibility: 'community',
        contact_visibility: 'stewards',
        resume_visibility: 'community',
        allow_ai_summary: true,
        helper_activity_visible: false,
        public_meet_page_enabled: true,
      }),
    });

    await expect(getPrivacySettingsByIdentityId(supabase, IDENTITY_ID)).resolves.toEqual({
      ...getDefaultPrivacySettings(),
      profileVisibility: 'members',
      contactVisibility: 'helpers',
      resumeVisibility: 'members',
      allowAiSummary: true,
      publicMeetPageEnabled: true,
    });
    expect(calls.from).toHaveBeenCalledWith('privacy_settings');
    expect(calls.eq).toHaveBeenCalledWith('identity_id', IDENTITY_ID);
  });

  it('returns null when an identity has no privacy settings row', async () => {
    const { supabase } = createSupabaseMock({ maybeSingleData: null });

    await expect(getPrivacySettingsByIdentityId(supabase, IDENTITY_ID)).resolves.toBeNull();
  });

  it('throws query errors without masking them', async () => {
    const error = new Error('database unavailable');
    const { supabase } = createSupabaseMock({ maybeSingleError: error });

    await expect(getPrivacySettingsByIdentityId(supabase, IDENTITY_ID)).rejects.toThrow(error);
  });

  it('upserts privacy settings using stored privacy visibility values', async () => {
    const { supabase, calls } = createSupabaseMock({
      singleData: privacySettingsRow({
        profile_visibility: 'community',
        contact_visibility: 'stewards',
        resume_visibility: 'community',
        allow_ai_summary: true,
        helper_activity_visible: false,
        public_meet_page_enabled: true,
      }),
    });

    await expect(
      upsertPrivacySettings(supabase, IDENTITY_ID, {
        profileVisibility: 'public',
        contactVisibility: 'helpers',
        resumeVisibility: 'introduction',
        allowAiSummary: true,
        publicMeetPageEnabled: true,
      }),
    ).resolves.toMatchObject({
      profileVisibility: 'members',
      contactVisibility: 'helpers',
      resumeVisibility: 'members',
      allowAiSummary: true,
      publicMeetPageEnabled: true,
    });
    expect(calls.upsert).toHaveBeenCalledWith(
      {
        identity_id: IDENTITY_ID,
        profile_visibility: 'community',
        contact_visibility: 'stewards',
        resume_visibility: 'community',
        allow_ai_summary: true,
        helper_activity_visible: false,
        public_meet_page_enabled: true,
      },
      { onConflict: 'identity_id' },
    );
  });

  it('creates default privacy settings when none exist', async () => {
    const { supabase, calls } = createSupabaseMock({
      maybeSingleData: null,
      singleData: privacySettingsRow(),
    });

    await expect(ensureDefaultPrivacySettings(supabase, IDENTITY_ID)).resolves.toEqual(
      getDefaultPrivacySettings(),
    );
    expect(calls.maybeSingle).toHaveBeenCalledTimes(1);
    expect(calls.upsert).toHaveBeenCalledWith(createPrivacySettingsUpsertPayload(IDENTITY_ID), {
      onConflict: 'identity_id',
    });
  });

  it('does not upsert when privacy settings already exist', async () => {
    const { supabase, calls } = createSupabaseMock({ maybeSingleData: privacySettingsRow() });

    await expect(ensureDefaultPrivacySettings(supabase, IDENTITY_ID)).resolves.toEqual(
      getDefaultPrivacySettings(),
    );
    expect(calls.upsert).not.toHaveBeenCalled();
  });
});
