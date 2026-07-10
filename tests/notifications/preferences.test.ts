import { describe, expect, it } from 'vitest';
import { canEnqueueOptionalNotification, createNotificationPreferencesPayload, getDefaultNotificationPreferences, isOptionalMessageEligible, processUnsubscribeRequest, createUnsubscribeToken } from '@/lib/notifications/preferences';
import { hashUnsubscribeToken } from '@/lib/notifications/preferences/tokens';

function createClient(row: any) {
  const state = { row, upserts: [] as any[], updates: [] as any[] };
  const client = {
    state,
    from(table: string) {
      if (table === 'notification_preferences') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.upserts.at(-1) ?? null, error: null }) }) }),
          upsert: (payload: any) => {
            state.upserts.push({
              id: 'pref-1',
              ...payload,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            return { select: () => ({ single: async () => ({ data: state.upserts.at(-1), error: null }) }) };
          },
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.row, error: null }) }) }),
        update: (payload: any) => ({ eq: () => ({ select: () => ({ single: async () => { state.updates.push(payload); return { data: { ...state.row, ...payload }, error: null }; } }) }) }),
      };
    },
  };
  return client as any;
}

describe('notification preferences', () => {
  it('uses restrictive optional defaults while keeping required transactional categories enabled', () => {
    expect(getDefaultNotificationPreferences()).toEqual({
      operational_invites: true,
      introduction_coordination: true,
      follow_up_reminders: false,
      outcome_prompts: false,
    });

    expect(createNotificationPreferencesPayload('identity-1', {
      operational_invites: false,
      introduction_coordination: false,
      follow_up_reminders: true,
    })).toMatchObject({
      operational_invites_enabled: true,
      introduction_coordination_enabled: true,
      follow_up_reminders_enabled: true,
      outcome_prompts_enabled: false,
    });
  });

  it('suppresses optional messages after unsubscribe while required messages remain eligible', async () => {
    const token = 'opaque-token';
    const client = createClient({
      id: 'unsub-1',
      identity_id: 'identity-1',
      token_hash: hashUnsubscribeToken(token),
      scope: 'all_optional',
      used_at: null,
      expires_at: '2099-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
    });

    await expect(processUnsubscribeRequest(client, token, new Date('2026-01-02T00:00:00.000Z'))).resolves.toEqual({ ok: true, scope: 'all_optional' });
    expect(client.state.upserts.at(-1)).toMatchObject({ follow_up_reminders_enabled: false, outcome_prompts_enabled: false, operational_invites_enabled: true, introduction_coordination_enabled: true });
    expect(isOptionalMessageEligible({ operational_invites: true, introduction_coordination: true, follow_up_reminders: false, outcome_prompts: false }, 'operational_invites')).toBe(true);
    await expect(canEnqueueOptionalNotification(client, 'identity-1', 'follow_up_reminders')).resolves.toBe(false);
  });

  it('generates opaque tokens and stores only hashes', () => {
    const generated = createUnsubscribeToken(new Date('2026-01-01T00:00:00.000Z'));
    expect(generated.token).not.toEqual(generated.tokenHash);
    expect(generated.tokenHash).toHaveLength(64);
    expect(generated.expiresAt).toBe('2026-01-31T00:00:00.000Z');
  });
});
