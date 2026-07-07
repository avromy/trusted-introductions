import { describe, expect, it } from 'vitest';

import {
  getProfileByIdentityId,
  markProfileComplete,
  updateProfileContributionMode,
  upsertProfile,
  type ProfileRow,
  type ProfilesSupabaseClient,
} from '@/lib/profiles';

const baseProfile: ProfileRow = {
  id: 'profile-1',
  identity_id: 'identity-1',
  display_name: 'Ada Lovelace',
  headline: 'Community helper',
  summary: 'Helps with trusted introductions.',
  contribution_mode: 'helper',
  completed_at: null,
  created_at: '2026-07-07T00:00:00.000Z',
  updated_at: '2026-07-07T00:00:00.000Z',
};

type RecordedCall =
  | { action: 'select'; columns?: string }
  | { action: 'eq'; column: string; value: string }
  | { action: 'maybeSingle' }
  | { action: 'upsert'; payload: unknown; options: unknown }
  | { action: 'update'; payload: unknown }
  | { action: 'single' };

function createProfileClient(result: { data: ProfileRow | null; error: Error | null }): {
  calls: RecordedCall[];
  client: ProfilesSupabaseClient;
} {
  const calls: RecordedCall[] = [];

  const mutationQuery = {
    select(columns?: string) {
      calls.push({ action: 'select', columns });

      return {
        async single() {
          calls.push({ action: 'single' });
          return result;
        },
      };
    },
  };

  const client: ProfilesSupabaseClient = {
    from(table) {
      expect(table).toBe('profiles');

      return {
        select(columns?: string) {
          calls.push({ action: 'select', columns });

          return {
            eq(column, value) {
              calls.push({ action: 'eq', column, value });

              return {
                async maybeSingle() {
                  calls.push({ action: 'maybeSingle' });
                  return result;
                },
              };
            },
          };
        },
        upsert(payload, options) {
          calls.push({ action: 'upsert', payload, options });
          return mutationQuery;
        },
        update(payload) {
          calls.push({ action: 'update', payload });

          return {
            eq(column, value) {
              calls.push({ action: 'eq', column, value });
              return mutationQuery;
            },
          };
        },
      };
    },
  };

  return { calls, client };
}

describe('profile repository helpers', () => {
  it('gets a profile by identity id without exposing unrelated writes', async () => {
    const { calls, client } = createProfileClient({ data: baseProfile, error: null });

    await expect(getProfileByIdentityId(client, 'identity-1')).resolves.toEqual(baseProfile);

    expect(calls).toEqual([
      expect.objectContaining({ action: 'select' }),
      { action: 'eq', column: 'identity_id', value: 'identity-1' },
      { action: 'maybeSingle' },
    ]);
  });

  it('returns null when no profile exists for an identity', async () => {
    const { client } = createProfileClient({ data: null, error: null });

    await expect(getProfileByIdentityId(client, 'identity-1')).resolves.toBeNull();
  });

  it('upserts only isolated profile fields by identity id', async () => {
    const { calls, client } = createProfileClient({ data: baseProfile, error: null });

    await expect(
      upsertProfile(client, {
        identityId: 'identity-1',
        displayName: 'Ada Lovelace',
        headline: 'Community helper',
        summary: null,
        contributionMode: 'helper',
      }),
    ).resolves.toEqual(baseProfile);

    expect(calls).toContainEqual({
      action: 'upsert',
      payload: {
        identity_id: 'identity-1',
        display_name: 'Ada Lovelace',
        headline: 'Community helper',
        summary: null,
        contribution_mode: 'helper',
      },
      options: { onConflict: 'identity_id' },
    });
    expect(calls).not.toContainEqual(expect.objectContaining({ action: 'update' }));
  });

  it('updates profile contribution mode only', async () => {
    const { calls, client } = createProfileClient({
      data: { ...baseProfile, contribution_mode: 'both' },
      error: null,
    });

    await expect(updateProfileContributionMode(client, 'identity-1', 'both')).resolves.toMatchObject({
      contribution_mode: 'both',
    });

    expect(calls).toContainEqual({ action: 'update', payload: { contribution_mode: 'both' } });
    expect(calls).toContainEqual({ action: 'eq', column: 'identity_id', value: 'identity-1' });
  });

  it('marks a profile complete with a deterministic timestamp', async () => {
    const completedAt = new Date('2026-07-07T12:00:00.000Z');
    const { calls, client } = createProfileClient({
      data: { ...baseProfile, completed_at: completedAt.toISOString() },
      error: null,
    });

    await expect(markProfileComplete(client, 'identity-1', completedAt)).resolves.toMatchObject({
      completed_at: '2026-07-07T12:00:00.000Z',
    });

    expect(calls).toContainEqual({
      action: 'update',
      payload: { completed_at: '2026-07-07T12:00:00.000Z' },
    });
    expect(calls).toContainEqual({ action: 'eq', column: 'identity_id', value: 'identity-1' });
  });

  it('throws repository errors and rejects blank identity ids', async () => {
    const error = new Error('database unavailable');
    const { client } = createProfileClient({ data: null, error });

    await expect(getProfileByIdentityId(client, 'identity-1')).rejects.toThrow(error);
    await expect(getProfileByIdentityId(client, '   ')).rejects.toThrow(
      'Profile identity id is required.',
    );
  });
});
