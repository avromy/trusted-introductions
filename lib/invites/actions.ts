'use server';

import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

import { validateInviteForRedemption, type SafeInviteValidationResult } from './lifecycle';
import { hashInviteToken } from './tokens';

type InvitationRow = Database['public']['Tables']['invitations']['Row'];
type InviteLookupRow = Pick<
  InvitationRow,
  | 'id'
  | 'invitee_email'
  | 'community_id'
  | 'expires_at'
  | 'redeemed_at'
  | 'redemption_status'
  | 'status'
  | 'token_hash'
>;

type InviteLookupResult = {
  data: InviteLookupRow | null;
  error: Error | null;
};

type InviteLookupQuery = {
  select(columns: string): {
    eq(
      column: 'token_hash',
      value: string,
    ): {
      maybeSingle(): Promise<InviteLookupResult>;
    };
  };
};

type InviteLookupSupabaseClient = {
  from(table: 'invitations'): InviteLookupQuery;
};

const INVITE_VALIDATION_COLUMNS = [
  'id',
  'invitee_email',
  'community_id',
  'expires_at',
  'redeemed_at',
  'redemption_status',
  'status',
  'token_hash',
].join(',');

export async function validateInviteTokenAction(
  token: string,
): Promise<SafeInviteValidationResult> {
  if (token.trim().length === 0) {
    return { valid: false, reason: 'token_mismatch' };
  }

  const tokenHash = hashInviteToken(token);
  const supabase = createClient() as unknown as InviteLookupSupabaseClient;
  const { data: invite, error } = await supabase
    .from('invitations')
    .select(INVITE_VALIDATION_COLUMNS)
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!invite) {
    return { valid: false, reason: 'token_mismatch' };
  }

  return validateInviteForRedemption({ invite, token });
}
