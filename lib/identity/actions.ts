'use server';

import { createAuditEventPayload } from '@/lib/audit';
import { insertAuditEvent, type AuditEventsSupabaseClient } from '@/lib/audit/server';
import { requireCurrentUser, type AuthUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/supabase';

type TrustedIdentityRow = Database['public']['Tables']['trusted_identities']['Row'];

type TrustedIdentityInsert = {
  user_id: string;
  primary_email: string;
  status: Database['public']['Enums']['trusted_identity_status'];
  metadata: Json;
};

type QuerySingleResult = {
  data: TrustedIdentityRow | null;
  error: { code?: string; message?: string } | Error | null;
};

type InsertSingleResult = {
  data: TrustedIdentityRow | null;
  error: Error | null;
};

type TrustedIdentityQueryBuilder = {
  select(columns?: string): TrustedIdentityQueryBuilder;
  eq(column: 'user_id' | 'primary_email', value: string): TrustedIdentityQueryBuilder;
  maybeSingle(): Promise<QuerySingleResult>;
};

type TrustedIdentityInsertBuilder = {
  select(columns?: string): TrustedIdentityInsertBuilder;
  single(): Promise<InsertSingleResult>;
};

type TrustedIdentitiesSupabaseClient = AuditEventsSupabaseClient & {
  from(table: 'trusted_identities'): {
    select(columns?: string): TrustedIdentityQueryBuilder;
    insert(payload: TrustedIdentityInsert): TrustedIdentityInsertBuilder;
  };
};

export type TrustedIdentityActionClient = TrustedIdentitiesSupabaseClient & Parameters<typeof requireCurrentUser>[0];

export type EnsureCurrentTrustedIdentityResult = {
  identity: TrustedIdentityRow;
  created: boolean;
};

export class TrustedIdentityActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrustedIdentityActionError';
  }
}

function getServerActionClient(): TrustedIdentityActionClient {
  return createClient() as unknown as TrustedIdentityActionClient;
}

export function normalizeTrustedIdentityEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getNormalizedUserEmail(user: AuthUser): string {
  const email = typeof user.email === 'string' ? normalizeTrustedIdentityEmail(user.email) : '';

  if (!email) {
    throw new TrustedIdentityActionError('Current user must have an email to create a trusted identity.');
  }

  return email;
}

async function findTrustedIdentityByUserId(
  supabase: TrustedIdentitiesSupabaseClient,
  userId: string,
): Promise<TrustedIdentityRow | null> {
  const { data, error } = await supabase
    .from('trusted_identities')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function createTrustedIdentity(
  supabase: TrustedIdentitiesSupabaseClient,
  user: AuthUser,
  email: string,
): Promise<TrustedIdentityRow> {
  const { data, error } = await supabase
    .from('trusted_identities')
    .insert({
      user_id: user.id,
      primary_email: email,
      status: 'active',
      metadata: {},
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new TrustedIdentityActionError('Trusted identity was not returned after creation.');
  }

  return data;
}

async function writeTrustedIdentityCreatedAuditEvent(
  supabase: TrustedIdentitiesSupabaseClient,
  user: AuthUser,
  identity: TrustedIdentityRow,
): Promise<void> {
  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'onboarding.started',
      actor: { type: 'user', id: user.id },
      target: { type: 'trusted_identity', id: identity.id },
      metadata: {
        primaryEmail: identity.primary_email,
        action: 'trusted_identity.created',
      },
    }),
  );
}

export async function ensureCurrentTrustedIdentityAction(
  client?: TrustedIdentityActionClient,
): Promise<EnsureCurrentTrustedIdentityResult> {
  const supabase = client ?? getServerActionClient();
  const user = await requireCurrentUser(supabase);
  const email = getNormalizedUserEmail(user);
  const existingIdentity = await findTrustedIdentityByUserId(supabase, user.id);

  if (existingIdentity) {
    return { identity: existingIdentity, created: false };
  }

  const identity = await createTrustedIdentity(supabase, user, email);
  await writeTrustedIdentityCreatedAuditEvent(supabase, user, identity);

  return { identity, created: true };
}
