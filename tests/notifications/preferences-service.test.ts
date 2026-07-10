import { describe, expect, it } from 'vitest';
import { createUnsubscribeToken } from '@/lib/notifications/preferences';
import { notificationAllowed, verifyUnsubscribeToken } from '@/lib/notifications/preferences/service';

describe('notification preference service', () => {
  it('keeps transactional categories enabled and optional categories opt-in', () => {
    expect(notificationAllowed({ category: 'invite_delivery', unsubscribed: true })).toBe(true);
    expect(notificationAllowed({ category: 'follow_up_reminder' })).toBe(false);
    expect(notificationAllowed({ category: 'follow_up_reminder', explicitPreference: true })).toBe(true);
    expect(notificationAllowed({ category: 'follow_up_reminder', explicitPreference: true, unsubscribed: true })).toBe(false);
  });

  it('verifies opaque unsubscribe tokens by hash only', () => {
    const token = createUnsubscribeToken();
    expect(verifyUnsubscribeToken(token.plaintextToken, token.tokenHash)).toBe(true);
    expect(verifyUnsubscribeToken('wrong-token', token.tokenHash)).toBe(false);
  });
});
