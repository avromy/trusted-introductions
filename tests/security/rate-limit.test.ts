import { describe, expect, it } from 'vitest';

import {
  InMemoryRateLimiter,
  RateLimitExceededError,
  assertRateLimitAllowed,
  hashScopedIdentifier,
  rateLimitRules,
  scopedRateLimitKey,
} from '@/lib/security/rate-limit';
import { validateInviteTokenAction } from '@/lib/invites/actions';
import { hashInviteToken } from '@/lib/invites/tokens';

const NOW = new Date('2025-01-01T00:00:00.000Z');

function inviteClient() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  };
}

describe('rate limit foundations', () => {
  it('allows requests below the configured threshold', async () => {
    const limiter = new InMemoryRateLimiter(new Map());
    const outcome = await limiter.check(
      { namespace: 'test-allowed', limit: 2, windowMs: 1000 },
      ['user-1'],
      NOW,
    );

    expect(outcome.allowed).toBe(true);
    expect(outcome.remaining).toBe(1);
  });

  it('reports threshold reached without exposing key material', async () => {
    const limiter = new InMemoryRateLimiter(new Map());
    const rule = { namespace: 'test-threshold', limit: 1, windowMs: 1000 };

    await assertRateLimitAllowed(limiter, rule, ['secret-token'], NOW);
    await expect(assertRateLimitAllowed(limiter, rule, ['secret-token'], NOW)).rejects.toThrow(
      RateLimitExceededError,
    );
  });

  it('resets buckets after the window elapses', async () => {
    const limiter = new InMemoryRateLimiter(new Map());
    const rule = { namespace: 'test-reset', limit: 1, windowMs: 1000 };

    expect((await limiter.check(rule, ['identity'], NOW)).allowed).toBe(true);
    expect((await limiter.check(rule, ['identity'], new Date(NOW.getTime() + 999))).allowed).toBe(
      false,
    );
    expect((await limiter.check(rule, ['identity'], new Date(NOW.getTime() + 1000))).allowed).toBe(
      true,
    );
  });

  it('separates scopes for the same identifier', async () => {
    const limiter = new InMemoryRateLimiter(new Map());
    const rule = { namespace: 'test-scoped', limit: 1, windowMs: 1000 };

    expect((await limiter.check(rule, scopedRateLimitKey('scope-a', 'same-id'), NOW)).allowed).toBe(
      true,
    );
    expect((await limiter.check(rule, scopedRateLimitKey('scope-b', 'same-id'), NOW)).allowed).toBe(
      true,
    );
  });

  it('uses hashed token-derived keys for invite validation attempts', async () => {
    const limiter = new InMemoryRateLimiter(new Map());
    const token = 'plaintext-invite-token';
    const tokenHash = hashInviteToken(token);
    const scoped = scopedRateLimitKey(
      'invite-validation',
      hashScopedIdentifier('invite-token', tokenHash),
    );

    expect(JSON.stringify(scoped)).not.toContain(token);
    expect(JSON.stringify(scoped)).not.toContain(tokenHash);

    for (let i = 0; i < rateLimitRules.inviteValidation.limit; i += 1) {
      const result = await validateInviteTokenAction(token, {
        // The test client only needs the not-found repository surface.
        supabase: inviteClient() as never,
        rateLimiter: limiter,
        now: NOW,
      });
      expect(result).toEqual({ valid: false, reason: 'not_found' });
    }

    await expect(
      validateInviteTokenAction(token, {
        supabase: inviteClient() as never,
        rateLimiter: limiter,
        now: NOW,
      }),
    ).resolves.toEqual({ valid: false, reason: 'rate_limited' });
  });
});
