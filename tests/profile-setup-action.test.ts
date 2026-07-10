import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveOnboardingProfileAction } from '@/lib/profiles/actions';

const mockCreateClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

type TableName = 'trusted_identities' | 'profiles' | 'audit_events';

function createMockSupabase(options: {
  user?: { id: string } | null;
  trustedIdentity?: { id: string; user_id: string; status: string } | null;
  profileError?: Error | null;
  auditError?: Error | null;
} = {}) {
  const profileRow = {
    id: 'profile-123',
    identity_id: 'identity-123',
    display_name: 'Ada Lovelace',
    headline: 'Building trustworthy introductions',
    summary: 'I help members find warm, relevant connections.',
    location: 'London',
    completed_at: '2026-07-07T00:00:00.000Z',
    updated_at: '2026-07-07T00:00:00.000Z',
  };
  const upsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({
        data: options.profileError ? null : profileRow,
        error: options.profileError ?? null,
      })),
    })),
  }));
  const auditInsert = vi.fn(async () => ({ error: options.auditError ?? null }));
  const maybeSingle = vi.fn(async () => ({
    data:
      options.trustedIdentity === undefined
        ? { id: 'identity-123', user_id: 'user-123', status: 'active' }
        : options.trustedIdentity,
    error: null,
  }));
  const getUser = vi.fn(async () => ({
    data: { user: options.user === undefined ? { id: 'user-123' } : options.user },
    error: null,
  }));

  return {
    auth: { getUser },
    upsert,
    auditInsert,
    maybeSingle,
    from: vi.fn((table: TableName) => {
      if (table === 'trusted_identities') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle })),
          })),
        };
      }

      if (table === 'profiles') {
        return { upsert };
      }

      return { insert: auditInsert };
    }),
  };
}

describe('saveOnboardingProfileAction', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
  });

  it('requires a current trusted identity', async () => {
    const supabase = createMockSupabase({ trustedIdentity: null });
    mockCreateClient.mockReturnValue(supabase);

    await expect(
      saveOnboardingProfileAction({ displayName: 'Ada Lovelace' }),
    ).rejects.toThrow('A trusted identity is required to set up a profile.');

    expect(supabase.upsert).not.toHaveBeenCalled();
    expect(supabase.auditInsert).not.toHaveBeenCalled();
  });

  it('validates basic profile fields before writing', async () => {
    const supabase = createMockSupabase();
    mockCreateClient.mockReturnValue(supabase);

    await expect(saveOnboardingProfileAction({ displayName: 'A' })).rejects.toThrow(
      'Display name must be at least 2 characters.',
    );

    expect(supabase.upsert).not.toHaveBeenCalled();
    expect(supabase.auditInsert).not.toHaveBeenCalled();
  });

  it('ignores client-supplied identity ids and only updates the current trusted identity profile', async () => {
    const supabase = createMockSupabase({
      trustedIdentity: { id: 'current-identity', user_id: 'user-123', status: 'active' },
    });
    mockCreateClient.mockReturnValue(supabase);

    await saveOnboardingProfileAction({
      displayName: 'Ada Lovelace',
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

  it('rejects inactive trusted identities before mutating profiles', async () => {
    const supabase = createMockSupabase({
      trustedIdentity: { id: 'identity-123', user_id: 'user-123', status: 'suspended' },
    });
    mockCreateClient.mockReturnValue(supabase);

    await expect(
      saveOnboardingProfileAction({ displayName: 'Ada Lovelace' }),
    ).rejects.toThrow('An active trusted identity is required to set up a profile.');

    expect(supabase.upsert).not.toHaveBeenCalled();
    expect(supabase.auditInsert).not.toHaveBeenCalled();
  });

  it('upserts the profile, writes an audit event, and returns a safe result', async () => {
    const supabase = createMockSupabase();
    mockCreateClient.mockReturnValue(supabase);

    const result = await saveOnboardingProfileAction({
      displayName: '  Ada Lovelace  ',
      headline: '  Building trustworthy introductions  ',
      summary: '  I help members find warm, relevant connections.  ',
      location: '  London  ',
    });

    expect(supabase.upsert).toHaveBeenCalledWith(
      {
        identity_id: 'identity-123',
        display_name: 'Ada Lovelace',
        headline: 'Building trustworthy introductions',
        summary: 'I help members find warm, relevant connections.',
        location: 'London',
        completed_at: expect.any(String),
      },
      { onConflict: 'identity_id' },
    );
    expect(supabase.auditInsert).toHaveBeenCalledWith({
      actor_identity_id: 'identity-123',
      event_type: 'onboarding.profile_saved',
      subject_table: 'profiles',
      subject_id: 'profile-123',
      metadata: { completedAt: expect.any(String) },
    });
    expect(result).toEqual({
      profile: {
        id: 'profile-123',
        identityId: 'identity-123',
        displayName: 'Ada Lovelace',
        headline: 'Building trustworthy introductions',
        summary: 'I help members find warm, relevant connections.',
        location: 'London',
        completedAt: '2026-07-07T00:00:00.000Z',
        updatedAt: '2026-07-07T00:00:00.000Z',
      },
    });
  });
});
