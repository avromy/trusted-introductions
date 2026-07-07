import { createClient } from '@/lib/supabase/server';

export type AuthUser = {
  id: string;
  email?: string;
  identities?: AuthIdentity[] | null;
  [key: string]: unknown;
};

export type AuthIdentity = {
  id?: string;
  identity_id?: string;
  user_id?: string;
  provider?: string;
  identity_data?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type SupabaseAuthClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: AuthUser | null };
      error: { message?: string } | null;
    }>;
  };
};

export type AuthHelperErrorCode =
  | 'AUTH_USER_LOOKUP_FAILED'
  | 'AUTH_REQUIRED'
  | 'AUTH_IDENTITY_REQUIRED';

export class AuthHelperError extends Error {
  constructor(
    message: string,
    public readonly code: AuthHelperErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AuthHelperError';
  }
}

export type CurrentUserResult =
  | { user: AuthUser; error: null }
  | { user: null; error: AuthHelperError | null };

export type CurrentIdentityResult =
  | { identity: AuthIdentity; error: null }
  | { identity: null; error: AuthHelperError | null };

function getServerAuthClient(): SupabaseAuthClient {
  return createClient() as unknown as SupabaseAuthClient;
}

function toLookupError(error: { message?: string } | null): AuthHelperError | null {
  if (!error) {
    return null;
  }

  return new AuthHelperError(
    error.message
      ? `Unable to load the current user: ${error.message}`
      : 'Unable to load the current user.',
    'AUTH_USER_LOOKUP_FAILED',
    error,
  );
}

function firstIdentityFor(user: AuthUser): AuthIdentity | null {
  return user.identities?.[0] ?? null;
}

export async function getCurrentUser(
  client?: SupabaseAuthClient,
): Promise<CurrentUserResult> {
  const authClient = client ?? getServerAuthClient();
  const { data, error } = await authClient.auth.getUser();
  const lookupError = toLookupError(error);

  if (lookupError) {
    return { user: null, error: lookupError };
  }

  return { user: data.user, error: null };
}

export async function requireCurrentUser(client?: SupabaseAuthClient): Promise<AuthUser> {
  const { user, error } = await getCurrentUser(client);

  if (error) {
    throw error;
  }

  if (!user) {
    throw new AuthHelperError('A signed-in user is required.', 'AUTH_REQUIRED');
  }

  return user;
}

export async function getCurrentIdentity(
  client?: SupabaseAuthClient,
): Promise<CurrentIdentityResult> {
  const { user, error } = await getCurrentUser(client);

  if (error) {
    return { identity: null, error };
  }

  if (!user) {
    return { identity: null, error: null };
  }

  const identity = firstIdentityFor(user);

  if (!identity) {
    return { identity: null, error: null };
  }

  return { identity, error: null };
}

export async function requireCurrentIdentity(client?: SupabaseAuthClient): Promise<AuthIdentity> {
  const { identity, error } = await getCurrentIdentity(client);

  if (error) {
    throw error;
  }

  if (!identity) {
    throw new AuthHelperError('A signed-in user identity is required.', 'AUTH_IDENTITY_REQUIRED');
  }

  return identity;
}
