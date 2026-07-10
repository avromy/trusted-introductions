import { beforeEach, describe, expect, it, vi } from 'vitest';

import { savePrivacySettingsAction } from '@/lib/privacy/actions';

const mockCreateClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

function createSupabaseMock(identityId = 'identity-123') {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const insert = vi.fn().mockResolvedValue({ error: null });
  const auth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'user-123', identities: [{ id: identityId }] } },
      error: null,
    }),
  };

  const client = {
    auth,
    from: vi.fn((table: string) => {
      if (table === 'privacy_settings') {
        return { upsert };
      }

      if (table === 'audit_events') {
        return { insert };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return { client, auth, upsert, insert };
}

describe('savePrivacySettingsAction', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
  });

  it('requires a current trusted identity before saving settings', async () => {
    const supabase = createSupabaseMock();
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    mockCreateClient.mockReturnValueOnce(supabase.client);

    await expect(savePrivacySettingsAction({})).rejects.toMatchObject({
      code: 'AUTH_IDENTITY_REQUIRED',
    });

    expect(supabase.upsert).not.toHaveBeenCalled();
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it('applies conservative defaults for omitted or non-boolean settings', async () => {
    const supabase = createSupabaseMock();
    mockCreateClient.mockReturnValueOnce(supabase.client);

    const result = await savePrivacySettingsAction({
      publicMeetPageEnabled: 'true' as unknown as boolean,
      allowAiSummary: true,
    });

    expect(result).toEqual({
      ok: true,
      settings: {
        profileVisibility: 'private',
        resumeVisibility: 'private',
        contactVisibility: 'private',
        publicMeetPageEnabled: false,
        helperActivityVisible: false,
        allowAiSummary: true,
      },
    });
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        identity_id: 'identity-123',
        profile_visibility: 'private',
        resume_visibility: 'private',
        contact_visibility: 'private',
        public_meet_page_enabled: false,
        allow_ai_summary: true,
      }),
      { onConflict: 'identity_id' },
    );
  });

  it('validates visibility values without writing unsafe data', async () => {
    const result = await savePrivacySettingsAction({
      profileVisibility: 'friends' as never,
      resumeVisibility: 'public',
      contactVisibility: 'members',
    });

    expect(result).toEqual({
      ok: false,
      error: 'Invalid profile visibility value.',
      settings: {
        profileVisibility: 'private',
        resumeVisibility: 'private',
        contactVisibility: 'private',
        publicMeetPageEnabled: false,
        helperActivityVisible: false,
        allowAiSummary: false,
      },
    });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('ignores client-supplied identity ids and only updates privacy for the current identity', async () => {
    const supabase = createSupabaseMock('current-identity');
    mockCreateClient.mockReturnValueOnce(supabase.client);

    await savePrivacySettingsAction({
      profileVisibility: 'members',
      identityId: 'attacker-controlled-identity',
    } as never);

    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ identity_id: 'current-identity' }),
      { onConflict: 'identity_id' },
    );
    expect(JSON.stringify(supabase.upsert.mock.calls)).not.toContain(
      'attacker-controlled-identity',
    );
  });

  it('rejects identities without a usable trusted identity id before mutating privacy settings', async () => {
    const supabase = createSupabaseMock('');
    mockCreateClient.mockReturnValueOnce(supabase.client);

    await expect(savePrivacySettingsAction({ profileVisibility: 'members' })).resolves.toEqual({
      ok: false,
      error: 'A trusted identity id is required.',
      settings: {
        profileVisibility: 'private',
        resumeVisibility: 'private',
        contactVisibility: 'private',
        publicMeetPageEnabled: false,
        helperActivityVisible: false,
        allowAiSummary: false,
      },
    });

    expect(supabase.upsert).not.toHaveBeenCalled();
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it('writes an audit event and returns only safe settings', async () => {
    const supabase = createSupabaseMock('identity-safe');
    mockCreateClient.mockReturnValueOnce(supabase.client);

    const result = await savePrivacySettingsAction({
      profileVisibility: 'public',
      resumeVisibility: 'helpers',
      contactVisibility: 'introduction',
      publicMeetPageEnabled: true,
      helperActivityVisible: true,
      allowAiSummary: false,
    });

    expect(result).toEqual({
      ok: true,
      settings: {
        profileVisibility: 'public',
        resumeVisibility: 'helpers',
        contactVisibility: 'introduction',
        publicMeetPageEnabled: true,
        helperActivityVisible: true,
        allowAiSummary: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain('identity-safe');
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'privacy_settings.updated',
        actor_type: 'user',
        actor_id: 'identity-safe',
        target_type: 'trusted_identity',
        target_id: 'identity-safe',
        metadata: { settings: result.settings },
      }),
    );
  });
});
