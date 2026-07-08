import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureCurrentTrustedIdentityAction } from '@/lib/identity/actions';
import { updateTrustedIdentityRoles } from '@/lib/identity';
import { hashInviteToken, validateInviteTokenAction, type InvitationRow } from '@/lib/invites';
import { getCurrentOnboardingProgress } from '@/lib/onboarding/server';
import { savePrivacySettingsAction } from '@/lib/privacy/actions';
import { saveOnboardingProfileAction } from '@/lib/profiles/actions';
import type { Database } from '@/types/supabase';

const mockCreateClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

type TrustedIdentityRow = Database['public']['Tables']['trusted_identities']['Row'];
type UserRoleRow = Database['public']['Tables']['user_roles']['Row'];
type ProfileRow = {
  id: string;
  identity_id: string;
  display_name: string;
  headline: string | null;
  summary: string | null;
  location: string | null;
  completed_at: string | null;
  updated_at: string;
};
type PrivacySettingsRow = Database['public']['Tables']['privacy_settings']['Row'];

type TableName =
  | 'audit_events'
  | 'invitations'
  | 'privacy_settings'
  | 'profiles'
  | 'trusted_identities'
  | 'user_roles';

const NOW = '2026-07-07T12:00:00.000Z';
const TOKEN = 'onboarding-invite-token';

function inviteRow(overrides: Partial<InvitationRow> = {}): InvitationRow {
  return {
    id: 'invite-123',
    invitee_email: 'invitee@example.com',
    inviter_identity_id: 'identity-inviter',
    community_id: 'community-123',
    token_hash: hashInviteToken(TOKEN),
    status: 'pending',
    redemption_status: 'not_redeemed',
    expires_at: '2026-07-14T12:00:00.000Z',
    redeemed_at: null,
    redeemed_by_identity_id: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function createInviteOnboardingFake() {
  const state = {
    user: { id: 'user-123', email: ' Invitee@Example.COM ' },
    invitations: [inviteRow()],
    trustedIdentities: [] as TrustedIdentityRow[],
    userRoles: [] as UserRoleRow[],
    profiles: [] as ProfileRow[],
    privacySettings: [] as PrivacySettingsRow[],
    auditEvents: [] as unknown[],
  };

  function currentUser() {
    const identity = state.trustedIdentities.find((row) => row.user_id === state.user.id);

    return {
      ...state.user,
      identities: identity
        ? [{ id: identity.id, identity_id: identity.id, user_id: identity.user_id ?? undefined }]
        : [],
    };
  }

  function maybeSingle(table: TableName, filters: Record<string, unknown>) {
    if (table === 'invitations') {
      const rows = state.invitations.filter((row) =>
        Object.entries(filters).every(
          ([column, value]) => row[column as keyof InvitationRow] === value,
        ),
      );

      return rows[0] ?? null;
    }

    if (table === 'trusted_identities') {
      return (
        state.trustedIdentities.find((row) =>
          Object.entries(filters).every(
            ([column, value]) => row[column as keyof TrustedIdentityRow] === value,
          ),
        ) ?? null
      );
    }

    if (table === 'user_roles') {
      return (
        state.userRoles.find((row) =>
          Object.entries(filters).every(
            ([column, value]) => row[column as keyof UserRoleRow] === value,
          ),
        ) ?? null
      );
    }

    if (table === 'profiles') {
      return (
        state.profiles.find((row) =>
          Object.entries(filters).every(
            ([column, value]) => row[column as keyof ProfileRow] === value,
          ),
        ) ?? null
      );
    }

    if (table === 'privacy_settings') {
      return (
        state.privacySettings.find((row) =>
          Object.entries(filters).every(
            ([column, value]) => row[column as keyof PrivacySettingsRow] === value,
          ),
        ) ?? null
      );
    }

    return null;
  }

  function query(table: TableName) {
    const filters: Record<string, unknown> = {};
    let inviteOrFilter: string | null = null;

    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      or: (filter: string) => {
        inviteOrFilter = filter;
        return builder;
      },
      async maybeSingle() {
        if (table === 'invitations' && inviteOrFilter) {
          const identityId = inviteOrFilter.match(/redeemed_by_identity_id\.eq\.([^,]+)/)?.[1];
          const inviteeEmail = inviteOrFilter.match(/invitee_email\.eq\.(.*)$/)?.[1];
          const row = state.invitations.find(
            (invite) =>
              (identityId && invite.redeemed_by_identity_id === identityId) ||
              (inviteeEmail && invite.invitee_email === inviteeEmail.trim().toLowerCase()),
          );

          return { data: row ?? null, error: null };
        }

        return { data: maybeSingle(table, filters), error: null };
      },
      async single() {
        return { data: maybeSingle(table, filters), error: null };
      },
    };

    return builder;
  }

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: currentUser() }, error: null })),
    },
    from: vi.fn((table: TableName) => ({
      select: () => query(table),
      insert: (payload: unknown) => {
        if (table === 'trusted_identities') {
          const row = {
            id: 'identity-123',
            display_name: null,
            legal_name: null,
            phone: null,
            created_at: NOW,
            updated_at: NOW,
            ...(payload as Partial<TrustedIdentityRow>),
          } as TrustedIdentityRow;
          state.trustedIdentities.push(row);

          return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
        }

        if (table === 'user_roles') {
          const roles = (payload as Array<Partial<UserRoleRow>>).map((role, index) => ({
            id: `role-${index + 1}`,
            created_at: NOW,
            updated_at: NOW,
            ...role,
          })) as UserRoleRow[];
          state.userRoles.push(...roles);

          return Promise.resolve({ data: roles, error: null });
        }

        if (table === 'audit_events') {
          state.auditEvents.push(payload);

          return Promise.resolve({ error: null });
        }

        throw new Error(`Unexpected insert into ${table}`);
      },
      delete: () => ({
        eq: async (column: keyof UserRoleRow, value: string) => {
          if (table === 'user_roles') {
            state.userRoles = state.userRoles.filter((role) => role[column] !== value);
          }

          return { error: null };
        },
      }),
      upsert: (payload: unknown) => {
        if (table === 'profiles') {
          const profile = {
            id: 'profile-123',
            updated_at: NOW,
            ...(payload as Partial<ProfileRow>),
          } as ProfileRow;
          state.profiles = [profile];

          return { select: () => ({ single: async () => ({ data: profile, error: null }) }) };
        }

        if (table === 'privacy_settings') {
          const settings = {
            id: 'privacy-123',
            created_at: NOW,
            ...(payload as Partial<PrivacySettingsRow>),
          } as PrivacySettingsRow;
          state.privacySettings = [settings];

          return Promise.resolve({ error: null });
        }

        throw new Error(`Unexpected upsert into ${table}`);
      },
    })),
  };

  return { client, state };
}

describe('invite to onboarding integration flow', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
  });

  it('validates an invite and completes identity, role, profile, privacy, and onboarding progress', async () => {
    const { client, state } = createInviteOnboardingFake();
    mockCreateClient.mockReturnValue(client);

    const inviteValidation = await validateInviteTokenAction(TOKEN, {
      supabase: client as never,
      now: new Date(NOW),
    });

    expect(inviteValidation).toEqual({
      valid: true,
      invite: {
        id: 'invite-123',
        inviteeEmail: 'invitee@example.com',
        communityId: 'community-123',
        expiresAt: '2026-07-14T12:00:00.000Z',
      },
    });

    const createdIdentity = await ensureCurrentTrustedIdentityAction(client as never);
    const loadedIdentity = await ensureCurrentTrustedIdentityAction(client as never);

    expect(createdIdentity).toMatchObject({ created: true, identity: { id: 'identity-123' } });
    expect(loadedIdentity).toEqual({ identity: createdIdentity.identity, created: false });

    await updateTrustedIdentityRoles(client as never, createdIdentity.identity.id, [
      { role: 'member', communityId: 'community-123', grantedByIdentityId: 'identity-inviter' },
    ]);

    await expect(
      saveOnboardingProfileAction({
        displayName: ' Invitee Example ',
        headline: ' Trusted introductions helper ',
        summary: ' I help members find warm and relevant connections. ',
        location: ' Remote ',
      }),
    ).resolves.toMatchObject({
      profile: {
        id: 'profile-123',
        identityId: 'identity-123',
        displayName: 'Invitee Example',
        headline: 'Trusted introductions helper',
        summary: 'I help members find warm and relevant connections.',
        location: 'Remote',
      },
    });

    await expect(
      savePrivacySettingsAction({
        profileVisibility: 'members',
        resumeVisibility: 'helpers',
        contactVisibility: 'introduction',
        publicMeetPageEnabled: false,
        helperActivityVisible: true,
        allowAiSummary: false,
      }),
    ).resolves.toEqual({
      ok: true,
      settings: {
        profileVisibility: 'members',
        resumeVisibility: 'helpers',
        contactVisibility: 'introduction',
        publicMeetPageEnabled: false,
        helperActivityVisible: true,
        allowAiSummary: false,
      },
    });

    const progress = await getCurrentOnboardingProgress();

    expect(progress.step).toBe('complete');
    expect(progress.isComplete).toBe(true);
    expect(progress.missingRequirements).toEqual([]);
    expect(progress.state).toMatchObject({
      trustedIdentity: {
        id: 'identity-123',
        status: 'active',
        roles: ['member'],
      },
      profile: {
        id: 'profile-123',
        displayName: 'Invitee Example',
      },
      privacySettings: {
        profileVisibility: 'community',
        resumeVisibility: 'stewards',
        contactVisibility: 'community',
        publicMeetPageEnabled: false,
        helperActivityVisible: true,
        allowAiSummary: false,
      },
      invite: {
        status: 'pending',
        expiresAt: '2026-07-14T12:00:00.000Z',
      },
    });
    expect(state.auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event_type: 'onboarding.started' }),
        expect.objectContaining({ event_type: 'onboarding.profile_saved' }),
        expect.objectContaining({ event_type: 'privacy_settings.updated' }),
      ]),
    );
  });
});
