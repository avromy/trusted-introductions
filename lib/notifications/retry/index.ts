export type RetryDecision =
  | { action: 'retry'; nextAttemptAt: Date }
  | { action: 'dead_letter'; classification: 'permanent' | 'unknown' };

export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 60_000,
  maxDelayMs: 60 * 60_000,
};

export function calculateRetryDecision(input: {
  attemptCount: number;
  failure: 'transient' | 'permanent';
  now?: Date;
  policy?: RetryPolicy;
}): RetryDecision {
  const policy = input.policy ?? DEFAULT_RETRY_POLICY;
  if (input.failure === 'permanent' || input.attemptCount >= policy.maxAttempts) {
    return { action: 'dead_letter', classification: input.failure === 'permanent' ? 'permanent' : 'unknown' };
  }
  const delay = Math.min(policy.baseDelayMs * 2 ** Math.max(0, input.attemptCount - 1), policy.maxDelayMs);
  return { action: 'retry', nextAttemptAt: new Date((input.now ?? new Date()).getTime() + delay) };
}
