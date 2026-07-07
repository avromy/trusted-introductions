import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const INVITE_TOKEN_BYTES = 32;
const INVITE_TOKEN_HASH_ALGORITHM = 'sha256';
const DEFAULT_INVITE_EXPIRATION_DAYS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type InviteTokenHash = string & { readonly __inviteTokenHash: unique symbol };

export function generateInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString('base64url');
}

export function hashInviteToken(token: string): InviteTokenHash {
  return createHash(INVITE_TOKEN_HASH_ALGORITHM)
    .update(token, 'utf8')
    .digest('hex') as InviteTokenHash;
}

export function compareInviteTokenHash(token: string, expectedHash: InviteTokenHash): boolean {
  const tokenHash = hashInviteToken(token);
  const tokenHashBuffer = Buffer.from(tokenHash, 'hex');
  const expectedHashBuffer = Buffer.from(expectedHash, 'hex');

  if (tokenHashBuffer.length !== expectedHashBuffer.length) {
    return false;
  }

  return timingSafeEqual(tokenHashBuffer, expectedHashBuffer);
}

export function getInviteExpirationDate(
  referenceDate: Date = new Date(),
  expirationDays: number = DEFAULT_INVITE_EXPIRATION_DAYS,
): Date {
  return new Date(referenceDate.getTime() + expirationDays * MILLISECONDS_PER_DAY);
}
