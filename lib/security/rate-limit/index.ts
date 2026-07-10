import { createHash } from 'node:crypto';

export type RateLimitOutcome = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

export type RateLimitKeyPart = string | number | boolean | null | undefined;

export interface RateLimitRule {
  namespace: string;
  limit: number;
  windowMs: number;
}

export interface RateLimiter {
  check(
    rule: RateLimitRule,
    keyParts: readonly RateLimitKeyPart[],
    now?: Date,
  ): Promise<RateLimitOutcome>;
}

const SAFE_LIMIT_MESSAGE = 'Too many attempts. Please wait before trying again.';

export class RateLimitExceededError extends Error {
  constructor(public readonly outcome: RateLimitOutcome) {
    super(SAFE_LIMIT_MESSAGE);
    this.name = 'RateLimitExceededError';
  }
}

export const rateLimitRules = {
  inviteValidation: { namespace: 'invite-validation', limit: 20, windowMs: 10 * 60 * 1000 },
  inviteCreation: { namespace: 'invite-creation', limit: 10, windowMs: 60 * 60 * 1000 },
  inviteRedemption: { namespace: 'invite-redemption', limit: 8, windowMs: 10 * 60 * 1000 },
  internalWorker: { namespace: 'internal-worker', limit: 30, windowMs: 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

export function hashScopedIdentifier(scope: string, value: string): string {
  return createHash('sha256').update(`${scope}:${value}`).digest('hex');
}

export function scopedRateLimitKey(scope: string, ...parts: readonly RateLimitKeyPart[]): string[] {
  return [
    scope,
    ...parts.map((part) => hashScopedIdentifier(scope, String(part ?? 'anonymous'))),
  ].filter(Boolean);
}

export function clientIpHashFromHeaders(headers: Pick<Headers, 'get'> | null | undefined): string {
  const forwardedFor = headers?.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = headers?.get('x-real-ip')?.trim();
  return hashScopedIdentifier('client-ip', forwardedFor || realIp || 'unknown');
}

const globalStore = new Map<string, { count: number; resetAtMs: number }>();

export class InMemoryRateLimiter implements RateLimiter {
  constructor(private readonly store = globalStore) {}

  async check(
    rule: RateLimitRule,
    keyParts: readonly RateLimitKeyPart[],
    now = new Date(),
  ): Promise<RateLimitOutcome> {
    const key = [rule.namespace, ...keyParts.map((part) => String(part ?? 'anonymous'))].join(':');
    const nowMs = now.getTime();
    const existing = this.store.get(key);
    const bucket =
      !existing || existing.resetAtMs <= nowMs
        ? { count: 0, resetAtMs: nowMs + rule.windowMs }
        : existing;

    bucket.count += 1;
    this.store.set(key, bucket);

    const allowed = bucket.count <= rule.limit;
    return {
      allowed,
      limit: rule.limit,
      remaining: Math.max(rule.limit - bucket.count, 0),
      resetAt: new Date(bucket.resetAtMs),
      retryAfterSeconds: allowed ? 0 : Math.max(Math.ceil((bucket.resetAtMs - nowMs) / 1000), 1),
    };
  }

  reset(): void {
    this.store.clear();
  }
}

let configuredLimiter: RateLimiter = new InMemoryRateLimiter();

export function getRateLimiter(): RateLimiter {
  return configuredLimiter;
}

export function setRateLimiterForTesting(limiter: RateLimiter): void {
  configuredLimiter = limiter;
}

export async function assertRateLimitAllowed(
  limiter: RateLimiter,
  rule: RateLimitRule,
  keyParts: readonly RateLimitKeyPart[],
  now?: Date,
): Promise<RateLimitOutcome> {
  const outcome = await limiter.check(rule, keyParts, now);
  if (!outcome.allowed) {
    throw new RateLimitExceededError(outcome);
  }
  return outcome;
}

export function toSafeRateLimitResult(): { ok: false; error: 'rate_limited'; message: string } {
  return { ok: false, error: 'rate_limited', message: SAFE_LIMIT_MESSAGE };
}

export function toSafeRateLimitedValidationResult(): { valid: false; reason: 'rate_limited' } {
  return { valid: false, reason: 'rate_limited' };
}
