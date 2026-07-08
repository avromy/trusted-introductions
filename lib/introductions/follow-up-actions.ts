'use server';

import { createAuditEventPayload } from '@/lib/audit';
import { insertAuditEvent, type AuditEventsSupabaseClient } from '@/lib/audit/server';
import {
  AuthHelperError,
  requireCurrentIdentity,
  type SupabaseAuthClient,
} from '@/lib/auth/session';
import {
  createIntroductionFollowUpPayload,
  createIntroductionFollowUpStatusUpdate,
  isIntroductionParticipant,
  type IntroductionFollowUpInsert,
  type IntroductionFollowUpRow,
  type IntroductionFollowUpStatus,
  type IntroductionFollowUpUpdate,
  type IntroductionRow,
} from '@/lib/introductions/follow-ups';
import { createClient } from '@/lib/supabase/server';

type QueryResult<T> = Promise<{ data: T | null; error: Error | null }>;

type IntroductionFollowUpDataClient = {
  from(table: 'introductions'): {
    select(columns: '*'): {
      eq(column: 'id', value: string): {
        single(): QueryResult<IntroductionRow>;
      };
    };
  };
  from(table: 'introduction_follow_ups'): {
    insert(payload: IntroductionFollowUpInsert): {
      select(columns: '*'): {
        single(): QueryResult<IntroductionFollowUpRow>;
      };
    };
    select(columns: '*'): {
      eq(column: 'id', value: string): {
        single(): QueryResult<IntroductionFollowUpRow>;
      };
      lte(column: 'due_at', value: string): {
        eq(column: 'status', value: 'pending'): {
          order(column: 'due_at', options: { ascending: true }): QueryResult<IntroductionFollowUpRow[]>;
        };
      };
    };
    update(payload: IntroductionFollowUpUpdate): {
      eq(column: 'id', value: string): {
        select(columns: '*'): {
          single(): QueryResult<IntroductionFollowUpRow>;
        };
      };
    };
  };
};

export type IntroductionFollowUpSupabaseClient = SupabaseAuthClient &
  AuditEventsSupabaseClient &
  IntroductionFollowUpDataClient;

export interface CreateIntroductionFollowUpActionInput {
  introductionId: string;
  dueAt: Date | string;
  note?: string | null;
}

export type IntroductionFollowUpActionResult =
  | { ok: true; followUp: IntroductionFollowUpRow }
  | { ok: false; error: 'validation_failed' | 'auth_required' | 'forbidden' | 'not_found'; message: string };

export type ListDueIntroductionFollowUpsActionResult =
  | { ok: true; followUps: IntroductionFollowUpRow[] }
  | { ok: false; error: 'auth_required'; message: string };

function getServerClient(): IntroductionFollowUpSupabaseClient {
  return createClient() as unknown as IntroductionFollowUpSupabaseClient;
}

function getIdentityId(identity: { identity_id?: string; id?: string; user_id?: string }): string {
  const identityId = identity.identity_id ?? identity.id ?? identity.user_id;

  if (!identityId?.trim()) {
    throw new AuthHelperError('A signed-in user identity is required.', 'AUTH_IDENTITY_REQUIRED');
  }

  return identityId;
}

function normalizeId(id: string, label: string): string | null {
  const normalized = id.trim();
  return normalized ? normalized : null;
}

async function getIntroduction(
  supabase: IntroductionFollowUpSupabaseClient,
  introductionId: string,
): Promise<IntroductionRow | null> {
  const { data, error } = await supabase
    .from('introductions')
    .select('*')
    .eq('id', introductionId)
    .single();

  if (error) {
    if (/0 rows|no rows|not found|multiple \(or no\) rows|JSON object requested/i.test(error.message)) {
      return null;
    }

    throw error;
  }

  return data;
}

async function getActorIdentityId(
  supabase: IntroductionFollowUpSupabaseClient,
): Promise<{ ok: true; actorIdentityId: string } | { ok: false }> {
  try {
    return { ok: true, actorIdentityId: getIdentityId(await requireCurrentIdentity(supabase)) };
  } catch (error) {
    if (error instanceof AuthHelperError) {
      return { ok: false };
    }

    throw error;
  }
}

export async function createIntroductionFollowUpAction(
  input: CreateIntroductionFollowUpActionInput,
  dependencies: { supabase?: IntroductionFollowUpSupabaseClient; now?: Date } = {},
): Promise<IntroductionFollowUpActionResult> {
  const introductionId = normalizeId(input.introductionId, 'Introduction id');

  if (!introductionId) {
    return { ok: false, error: 'validation_failed', message: 'Introduction id is required.' };
  }

  const supabase = dependencies.supabase ?? getServerClient();
  const now = dependencies.now ?? new Date();
  const actor = await getActorIdentityId(supabase);

  if (!actor.ok) {
    return { ok: false, error: 'auth_required', message: 'A signed-in trusted identity is required.' };
  }

  const introduction = await getIntroduction(supabase, introductionId);

  if (!introduction) {
    return { ok: false, error: 'not_found', message: 'Introduction not found.' };
  }

  if (!isIntroductionParticipant(introduction, actor.actorIdentityId)) {
    return { ok: false, error: 'forbidden', message: 'You are not allowed to manage follow-ups for this introduction.' };
  }

  let payload: IntroductionFollowUpInsert;

  try {
    payload = createIntroductionFollowUpPayload({
      introductionId,
      dueAt: input.dueAt,
      note: input.note,
      createdByIdentityId: actor.actorIdentityId,
      now,
    });
  } catch (error) {
    return { ok: false, error: 'validation_failed', message: error instanceof Error ? error.message : 'Invalid follow-up.' };
  }

  const { data, error } = await supabase.from('introduction_follow_ups').insert(payload).select('*').single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Follow-up creation did not return a row.');
  }

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: 'introduction_follow_up.created',
      actor: { type: 'user', id: actor.actorIdentityId },
      target: { type: 'introduction_follow_up', id: data.id },
      metadata: { introductionId, dueAt: data.due_at, status: data.status },
      occurredAt: now,
    }),
  );

  return { ok: true, followUp: data };
}

export async function updateIntroductionFollowUpStatusAction(
  followUpId: string,
  status: Extract<IntroductionFollowUpStatus, 'completed' | 'skipped'>,
  dependencies: { supabase?: IntroductionFollowUpSupabaseClient; now?: Date } = {},
): Promise<IntroductionFollowUpActionResult> {
  const normalizedFollowUpId = normalizeId(followUpId, 'Follow-up id');

  if (!normalizedFollowUpId) {
    return { ok: false, error: 'validation_failed', message: 'Follow-up id is required.' };
  }

  const supabase = dependencies.supabase ?? getServerClient();
  const now = dependencies.now ?? new Date();
  const actor = await getActorIdentityId(supabase);

  if (!actor.ok) {
    return { ok: false, error: 'auth_required', message: 'A signed-in trusted identity is required.' };
  }

  const { data: existing, error: selectError } = await supabase
    .from('introduction_follow_ups')
    .select('*')
    .eq('id', normalizedFollowUpId)
    .single();

  if (selectError || !existing) {
    return { ok: false, error: 'not_found', message: 'Follow-up not found.' };
  }

  const introduction = await getIntroduction(supabase, existing.introduction_id);

  if (!introduction) {
    return { ok: false, error: 'not_found', message: 'Introduction not found.' };
  }

  if (!isIntroductionParticipant(introduction, actor.actorIdentityId)) {
    return { ok: false, error: 'forbidden', message: 'You are not allowed to manage follow-ups for this introduction.' };
  }

  const update = createIntroductionFollowUpStatusUpdate({ status, actorIdentityId: actor.actorIdentityId, now });
  const { data, error } = await supabase
    .from('introduction_follow_ups')
    .update(update)
    .eq('id', normalizedFollowUpId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Follow-up status update did not return a row.');
  }

  await insertAuditEvent(
    supabase,
    createAuditEventPayload({
      eventType: status === 'completed' ? 'introduction_follow_up.completed' : 'introduction_follow_up.skipped',
      actor: { type: 'user', id: actor.actorIdentityId },
      target: { type: 'introduction_follow_up', id: data.id },
      metadata: { introductionId: data.introduction_id, previousStatus: existing.status, status: data.status },
      occurredAt: now,
    }),
  );

  return { ok: true, followUp: data };
}

export async function listDueIntroductionFollowUpsAction(
  dependencies: { supabase?: IntroductionFollowUpSupabaseClient; now?: Date } = {},
): Promise<ListDueIntroductionFollowUpsActionResult> {
  const supabase = dependencies.supabase ?? getServerClient();
  const now = dependencies.now ?? new Date();
  const actor = await getActorIdentityId(supabase);

  if (!actor.ok) {
    return { ok: false, error: 'auth_required', message: 'A signed-in trusted identity is required.' };
  }

  const { data, error } = await supabase
    .from('introduction_follow_ups')
    .select('*')
    .lte('due_at', now.toISOString())
    .eq('status', 'pending')
    .order('due_at', { ascending: true });

  if (error) {
    throw error;
  }

  const followUps = data ?? [];
  const introductions = await Promise.all(
    followUps.map((followUp: IntroductionFollowUpRow) => getIntroduction(supabase, followUp.introduction_id)),
  );

  return {
    ok: true,
    followUps: followUps.filter((followUp: IntroductionFollowUpRow, index: number) => {
      const introduction = introductions[index];
      return introduction ? isIntroductionParticipant(introduction, actor.actorIdentityId) : false;
    }),
  };
}
