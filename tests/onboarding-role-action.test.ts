import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveOnboardingRoleAction } from '@/lib/onboarding/role-actions';

const mockCreateClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

type TableName = 'trusted_identities' | 'user_roles' | 'profiles' | 'audit_events';

function createMockSupabase(options: {
  user?: { id: string } | null;
  identity?: { id: string; user_id: string; status: 'active' | 'pending' | 'suspended' } | null;
  rolesError?: Error | null;
  profileError?: Error | null;
  auditError?: Error | null;
} = {}) {
  const roleRow = {
    id: 'role-123',
    identity_id: 'identity-123',
    community_id: null,
    role: 'member',
    granted_by_identity_id: null,
    created_at: '2026-07-08T00:00:00.000Z',
    updated_at: '2026-07-08T00:00:00.000Z',
  };
  const profileRow = {
    id: 'profile-123',
    identity_id: 'identity-123',
    display_name: null,
    headline: null,
    summary: null,
    contribution_mode: 'helper',
    completed_at: null,
    created_at: '2026-07-08T00:00:00.000Z',
    updated_at: '2026-07-08T00:00:00.000Z',
  };
  const getUser = vi.fn(async () => ({
    data: { user: options.user === undefined ? { id: 'user-123' } : options.user },
    error: null,
  }));
  const identityMaybeSingle = vi.fn(async () => ({
    data:
      options.identity === undefined
        ? { id: 'identity-123', user_id: 'user-123', status: 'active' }
        : options.identity,
    error: null,
  }));
  const rolesLookupEq = vi.fn(async () => ({ data: [], error: null }));
  const roleDeleteEq = vi.fn(async () => ({ error: null }));
  const roleInsert = vi.fn(async () => ({
    data: options.rolesError ? null : [roleRow],
    error: options.rolesError ?? null,
  }));
  const profileUpsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({
        data: options.profileError ? null : profileRow,
        error: options.profileError ?? null,
      })),
    })),
  }));
  const auditInsert = vi.fn(async () => ({ error: options.auditError ?? null }));

  return {
    auth: { getUser },
    roleDeleteEq,
    roleInsert,
    profileUpsert,
    auditInsert,
    from: vi.fn((table: TableName) => {
      if (table === 'trusted_identities') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: identityMaybeSingle })) })) };
      }

      if (table === 'user_roles') {
        return {
          select: vi.fn(() => ({ eq: rolesLookupEq })),
          delete: vi.fn(() => ({ eq: roleDeleteEq })),
          insert: roleInsert,
        };
      }

      if (table === 'profiles') {
        return { upsert: profileUpsert };
      }

      return { insert: auditInsert };
    }),
  };
}

describe('saveOnboardingRoleAction', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
  });

  it('returns a safe validation error without writing invalid role data', async () => {
    const supabase = createMockSupabase();
    mockCreateClient.mockReturnValue(supabase);

    const result = await saveOnboardingRoleAction({
      selectedRoles: ['admin' as never],
      contributionMode: 'helper',
    });

    expect(result).toEqual({ ok: false, error: 'Invalid literal value, expected "member"' });
    expect(supabase.roleInsert).not.toHaveBeenCalled();
    expect(supabase.profileUpsert).not.toHaveBeenCalled();
    expect(supabase.auditInsert).not.toHaveBeenCalled();
  });

  it('requires an active current trusted identity before writing', async () => {
    const supabase = createMockSupabase({ identity: null });
    mockCreateClient.mockReturnValue(supabase);

    const result = await saveOnboardingRoleAction({
      selectedRoles: ['member'],
      contributionMode: 'job_seeker',
    });

    expect(result).toEqual({
      ok: false,
      error: 'A trusted identity is required to choose onboarding roles.',
    });
    expect(supabase.roleInsert).not.toHaveBeenCalled();
    expect(supabase.profileUpsert).not.toHaveBeenCalled();
    expect(supabase.auditInsert).not.toHaveBeenCalled();
  });

  it('ignores client-supplied identity ids and only updates roles for the current trusted identity', async () => {
    const supabase = createMockSupabase({
      identity: { id: 'current-identity', user_id: 'user-123', status: 'active' },
    });
    mockCreateClient.mockReturnValue(supabase);

    await saveOnboardingRoleAction({
      selectedRoles: ['member'],
      contributionMode: 'helper',
      identityId: 'attacker-controlled-identity',
    } as never);

    expect(supabase.roleDeleteEq).toHaveBeenCalledWith('identity_id', 'current-identity');
    expect(supabase.roleInsert).toHaveBeenCalledWith([
      expect.objectContaining({ identity_id: 'current-identity' }),
    ]);
    expect(supabase.profileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ identity_id: 'current-identity' }),
      { onConflict: 'identity_id' },
    );
    expect(JSON.stringify(supabase.roleInsert.mock.calls)).not.toContain(
      'attacker-controlled-identity',
    );
  });

  it('rejects inactive trusted identities before mutating roles or profile contribution mode', async () => {
    const supabase = createMockSupabase({
      identity: { id: 'identity-123', user_id: 'user-123', status: 'suspended' },
    });
    mockCreateClient.mockReturnValue(supabase);

    const result = await saveOnboardingRoleAction({
      selectedRoles: ['member'],
      contributionMode: 'job_seeker',
    });

    expect(result).toEqual({
      ok: false,
      error: 'An active trusted identity is required to choose onboarding roles.',
    });
    expect(supabase.roleInsert).not.toHaveBeenCalled();
    expect(supabase.profileUpsert).not.toHaveBeenCalled();
    expect(supabase.auditInsert).not.toHaveBeenCalled();
  });

  it('persists member role and contribution mode, audits the save, and returns safe data', async () => {
    const supabase = createMockSupabase();
    mockCreateClient.mockReturnValue(supabase);

    const result = await saveOnboardingRoleAction({
      selectedRoles: ['member'],
      contributionMode: 'helper',
    });

    expect(supabase.roleDeleteEq).toHaveBeenCalledWith('identity_id', 'identity-123');
    expect(supabase.roleInsert).toHaveBeenCalledWith([
      {
        identity_id: 'identity-123',
        role: 'member',
        community_id: null,
        granted_by_identity_id: null,
      },
    ]);
    expect(supabase.profileUpsert).toHaveBeenCalledWith(
      { identity_id: 'identity-123', contribution_mode: 'helper' },
      { onConflict: 'identity_id' },
    );
    expect(supabase.auditInsert).toHaveBeenCalledWith({
      actor_identity_id: 'identity-123',
      event_type: 'onboarding.role_saved',
      subject_table: 'trusted_identities',
      subject_id: 'identity-123',
      metadata: { selectedRoles: ['member'], contributionMode: 'helper' },
    });
    expect(result).toEqual({
      ok: true,
      identityId: 'identity-123',
      selectedRoles: [{ role: 'member', communityId: null }],
      contributionMode: 'helper',
    });
  });
});
