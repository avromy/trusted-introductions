import { describe, expect, it } from 'vitest';

import {
  compareInviteTokenHash,
  generateInviteToken,
  getInviteExpirationDate,
  hashInviteToken,
} from '@/lib/invites';

describe('invite token utilities', () => {
  it('generates URL-safe secure random invite tokens', () => {
    const token = generateInviteToken();
    const secondToken = generateInviteToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(secondToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(secondToken).not.toBe(token);
  });

  it('hashes tokens with stable verification behavior', () => {
    const token = 'invite-token-value';
    const hash = hashInviteToken(token);
    const secondHash = hashInviteToken(token);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(secondHash).toBe(hash);
    expect(compareInviteTokenHash(token, hash)).toBe(true);
  });

  it('fails comparison for a nonmatching token', () => {
    const hash = hashInviteToken('expected-token');

    expect(compareInviteTokenHash('different-token', hash)).toBe(false);
  });

  it('returns a future expiration date', () => {
    const referenceDate = new Date('2026-07-07T00:00:00.000Z');
    const expirationDate = getInviteExpirationDate(referenceDate);

    expect(expirationDate.getTime()).toBeGreaterThan(referenceDate.getTime());
    expect(expirationDate).toEqual(new Date('2026-07-14T00:00:00.000Z'));
  });
});
