import { getEnv } from '@/lib/env';
import type { Json } from '@/types/supabase';

export const INVITE_DELIVERY_NOTIFICATION_TYPE = 'invite.delivery' as const;

export type InviteDeliveryNotificationType = typeof INVITE_DELIVERY_NOTIFICATION_TYPE;

export interface InviteDeliveryInput {
  inviteId: string;
  inviteeEmail: string;
  inviterIdentityId: string;
  plaintextToken: string;
  communityId?: string | null;
  expiresAt?: string | null;
  appUrl?: string;
  now?: Date;
}

export interface InviteDeliveryOutboxPayload {
  notification_type: InviteDeliveryNotificationType;
  recipient: string;
  payload: {
    inviteId: string;
    inviteLink: string;
    communityId: string | null;
    expiresAt: string | null;
  };
  metadata: {
    inviteId: string;
    communityId: string | null;
    inviterIdentityId: string;
  };
  idempotency_key: string;
  status: 'pending';
  available_at: string;
}

export type InviteDeliveryOutboxRow = InviteDeliveryOutboxPayload & {
  id: string;
  created_at?: string;
  updated_at?: string;
};

type InviteDeliveryInsertResult = {
  data: Pick<InviteDeliveryOutboxRow, 'id' | 'idempotency_key'> | null;
  error: { message?: string; code?: string } | null;
};

type InviteDeliveryMaybeSingleResult = {
  data: Pick<InviteDeliveryOutboxRow, 'id' | 'idempotency_key'> | null;
  error: { message?: string; code?: string } | null;
};

export type InviteDeliveryNotificationClient = {
  from(table: 'notification_outbox'): {
    insert(payload: InviteDeliveryOutboxPayload): {
      select(columns: 'id,idempotency_key'): {
        maybeSingle(): Promise<InviteDeliveryInsertResult>;
      };
    };
    select(columns: 'id,idempotency_key'): {
      eq(column: 'idempotency_key', value: string): {
        maybeSingle(): Promise<InviteDeliveryMaybeSingleResult>;
      };
    };
  };
};

export type EnqueueInviteDeliveryResult =
  | { enqueued: true; notificationId: string; idempotencyKey: string }
  | { enqueued: false; notificationId: string | null; idempotencyKey: string; reason: 'duplicate' };

function normalizeBaseUrl(appUrl?: string): string {
  const configuredUrl = appUrl ?? getEnv().NEXT_PUBLIC_APP_URL;
  return configuredUrl.replace(/\/+$/, '');
}

export function buildInviteDeliveryIdempotencyKey(inviteId: string): string {
  const normalizedInviteId = inviteId.trim();

  if (!normalizedInviteId) {
    throw new Error('Invite id is required for invite delivery.');
  }

  return `invite-delivery:${normalizedInviteId}:created`;
}

export function buildInviteLink(appUrl: string | undefined, plaintextToken: string): string {
  const normalizedToken = plaintextToken.trim();

  if (!normalizedToken) {
    throw new Error('Plaintext invite token is required for invite delivery.');
  }

  const url = new URL('/auth', `${normalizeBaseUrl(appUrl)}/`);
  url.searchParams.set('invite', normalizedToken);

  return url.toString();
}

export function createInviteDeliveryOutboxPayload(
  input: InviteDeliveryInput,
): InviteDeliveryOutboxPayload {
  const inviteId = input.inviteId.trim();
  const inviteeEmail = input.inviteeEmail.trim().toLowerCase();
  const inviterIdentityId = input.inviterIdentityId.trim();

  if (!inviteId) {
    throw new Error('Invite id is required for invite delivery.');
  }

  if (!inviteeEmail) {
    throw new Error('Invitee email is required for invite delivery.');
  }

  if (!inviterIdentityId) {
    throw new Error('Inviter identity id is required for invite delivery.');
  }

  return {
    notification_type: INVITE_DELIVERY_NOTIFICATION_TYPE,
    recipient: inviteeEmail,
    payload: {
      inviteId,
      inviteLink: buildInviteLink(input.appUrl, input.plaintextToken),
      communityId: input.communityId ?? null,
      expiresAt: input.expiresAt ?? null,
    },
    metadata: {
      inviteId,
      communityId: input.communityId ?? null,
      inviterIdentityId,
    },
    idempotency_key: buildInviteDeliveryIdempotencyKey(inviteId),
    status: 'pending',
    available_at: (input.now ?? new Date()).toISOString(),
  };
}

function isDuplicateError(error: { message?: string; code?: string } | null): boolean {
  return error?.code === '23505' || /duplicate|unique/i.test(error?.message ?? '');
}

async function findExistingNotification(
  client: InviteDeliveryNotificationClient,
  idempotencyKey: string,
): Promise<Pick<InviteDeliveryOutboxRow, 'id' | 'idempotency_key'> | null> {
  const { data, error } = await client
    .from('notification_outbox')
    .select('id,idempotency_key')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to find invite delivery notification: ${error.message ?? 'unknown error'}`);
  }

  return data;
}

export async function enqueueInviteDeliveryNotification(
  client: InviteDeliveryNotificationClient,
  input: InviteDeliveryInput,
): Promise<EnqueueInviteDeliveryResult> {
  const payload = createInviteDeliveryOutboxPayload(input);
  const { data, error } = await client
    .from('notification_outbox')
    .insert(payload)
    .select('id,idempotency_key')
    .maybeSingle();

  if (!error && data) {
    return { enqueued: true, notificationId: data.id, idempotencyKey: data.idempotency_key };
  }

  if (isDuplicateError(error)) {
    const existing = await findExistingNotification(client, payload.idempotency_key);

    return {
      enqueued: false,
      notificationId: existing?.id ?? null,
      idempotencyKey: payload.idempotency_key,
      reason: 'duplicate',
    };
  }

  throw new Error(`Failed to enqueue invite delivery notification: ${error?.message ?? 'unknown error'}`);
}

export function inviteDeliveryPayloadContainsPlaintextToken(
  payload: Pick<InviteDeliveryOutboxPayload, 'metadata'>,
  plaintextToken: string,
): boolean {
  return JSON.stringify(payload.metadata as Json).includes(plaintextToken);
}
