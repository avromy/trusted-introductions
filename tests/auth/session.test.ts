import { describe, expect, it } from 'vitest';

import {
  AuthHelperError,
  getCurrentIdentity,
  getCurrentUser,
  requireCurrentIdentity,
  requireCurrentUser,
  type AuthUser,
} from '@/lib/auth/session';

function mockClient(user: AuthUser | null, message?: string) {
  return {
    auth: {
      getUser: async () => ({
        data: { user },
        error: message ? { message } : null,
      }),
    },
  };
}

describe('server auth session helpers', () => {
  it('returns the current user from Supabase auth', async () => {
    const user = { id: 'user-1', email: 'person@example.com' };

    await expect(getCurrentUser(mockClient(user))).resolves.toEqual({
      user,
      error: null,
    });
  });

  it('returns a typed lookup error without throwing for safe user reads', async () => {
    const result = await getCurrentUser(mockClient(null, 'session expired'));

    expect(result.user).toBeNull();
    expect(result.error).toBeInstanceOf(AuthHelperError);
    expect(result.error?.code).toBe('AUTH_USER_LOOKUP_FAILED');
    expect(result.error?.message).toContain('session expired');
  });

  it('requires a signed-in user without redirecting', async () => {
    await expect(requireCurrentUser(mockClient(null))).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
      message: 'A signed-in user is required.',
    });
  });

  it('returns the first current auth identity from the user payload', async () => {
    const identity = { identity_id: 'identity-1', provider: 'email' };
    const user = { id: 'user-1', identities: [identity] };

    await expect(getCurrentIdentity(mockClient(user))).resolves.toEqual({
      identity,
      error: null,
    });
  });

  it('requires a signed-in identity without redirecting', async () => {
    await expect(
      requireCurrentIdentity(mockClient({ id: 'user-1', identities: [] })),
    ).rejects.toMatchObject({
      code: 'AUTH_IDENTITY_REQUIRED',
      message: 'A signed-in user identity is required.',
    });
  });
});
