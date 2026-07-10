import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTES = 32;

export function generateOpaqueUnsubscribeToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashUnsubscribeToken(token: string): string {
  const normalized = token.trim();

  if (!normalized) {
    throw new Error('Unsubscribe token is required.');
  }

  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export function compareUnsubscribeTokenHash(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashUnsubscribeToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
