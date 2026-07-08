'use server';

import { requireCurrentTrustedIdentity, toSafeAuthFailureResult } from '@/lib/auth/steward';
import { createClient } from '@/lib/supabase/server';
import {
  buildFollowUpAuditEvent,
  createIntroductionFollowUp,
  isFollowUpDue,
  markFollowUpCompleted,
  markFollowUpSkipped,
  type IntroductionFollowUp,
  type IntroductionFollowUpEventPayload,
  type IntroductionFollowUpStatus,
} from '@/lib/introductions/follow-ups';

type IntroductionAccessRow = {
  id: string;
  requester_identity_id: string | null;
  helper_identity_id: string | null;
  steward_identity_id: string | null;
};

type FollowUpListQuery = {
  eq(column: string, value: string): FollowUpListQuery;
  lte(column: string, value: string): FollowUpListQuery;
  order(
    column: string,
    options?: { ascending?: boolean },
  ): Promise<{ data: FollowUpRow[] | null; error: Error | null }>;
};

type FollowUpRow = {
  id: string;
  introduction_id: string;
  created_by_identity_id: string;
  due_at: string;
  status: IntroductionFollowUpStatus;
  note: string | null;
  created_at: string;
  completed_at: string | null;
  skipped_at: string | null;
};

export type IntroductionFollowUpActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: 'validation' | 'auth_required' | 'forbidden'; message: string };

export type IntroductionFollowUpActionClient = Parameters<
  typeof requireCurrentTrustedIdentity
>[0] & {
  from(table: 'introductions'): {
    select(columns?: string): {
      eq(
        column: string,
        value: string,
      ): { maybeSingle(): Promise<{ data: IntroductionAccessRow | null; error: Error | null }> };
    };
  };
  from(table: 'introduction_follow_ups'): {
    insert(payload: Record<string, unknown>): {
      select(columns?: string): {
        single(): Promise<{ data: FollowUpRow | null; error: Error | null }>;
      };
    };
    select(columns?: string): FollowUpListQuery;
    update(payload: Record<string, unknown>): {
      eq(
        column: string,
        value: string,
      ): {
        select(columns?: string): {
          single(): Promise<{ data: FollowUpRow | null; error: Error | null }>;
        };
      };
    };
  };
  from(table: 'audit_events'): {
    insert(payload: IntroductionFollowUpEventPayload): Promise<{ error: Error | null }>;
  };
};

function getServerActionClient(): IntroductionFollowUpActionClient {
  return createClient() as unknown as IntroductionFollowUpActionClient;
}

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function rowToFollowUp(row: FollowUpRow): IntroductionFollowUp {
  return {
    id: row.id,
    introductionId: row.introduction_id,
    createdByIdentityId: row.created_by_identity_id,
    dueAt: row.due_at,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    skippedAt: row.skipped_at,
  };
}

function canAccessIntroduction(row: IntroductionAccessRow, identityId: string): boolean {
  return [row.requester_identity_id, row.helper_identity_id, row.steward_identity_id].includes(
    identityId,
  );
}

async function requireIntroductionAccess(
  supabase: IntroductionFollowUpActionClient,
  introductionId: string,
  identityId: string,
): Promise<IntroductionAccessRow> {
  const { data, error } = await supabase
    .from('introductions')
    .select('id, requester_identity_id, helper_identity_id, steward_identity_id')
    .eq('id', introductionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || !canAccessIntroduction(data, identityId)) {
    throw new Error('forbidden');
  }

  return data;
}

async function insertAudit(
  supabase: IntroductionFollowUpActionClient,
  event: IntroductionFollowUpEventPayload,
): Promise<void> {
  const { error } = await supabase.from('audit_events').insert(event);

  if (error) {
    throw error;
  }
}

export async function createIntroductionFollowUpAction(
  introductionId: string,
  formData: FormData,
  options: { supabase?: IntroductionFollowUpActionClient; now?: Date } = {},
): Promise<IntroductionFollowUpActionResult<IntroductionFollowUp>> {
  const supabase = options.supabase ?? getServerActionClient();

  try {
    const identity = await requireCurrentTrustedIdentity(supabase);
    await requireIntroductionAccess(supabase, introductionId.trim(), identity.id);
    const followUp = createIntroductionFollowUp({
      introductionId,
      createdByIdentityId: identity.id,
      dueAt: formValue(formData, 'dueAt'),
      note: formValue(formData, 'note'),
      now: options.now,
    });

    const { data, error } = await supabase
      .from('introduction_follow_ups')
      .insert({
        introduction_id: followUp.introductionId,
        created_by_identity_id: followUp.createdByIdentityId,
        due_at: followUp.dueAt,
        status: followUp.status,
        note: followUp.note,
        created_at: followUp.createdAt,
        completed_at: null,
        skipped_at: null,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw error ?? new Error('Unable to create follow-up reminder.');
    }

    const created = rowToFollowUp(data);
    await insertAudit(
      supabase,
      buildFollowUpAuditEvent({
        eventType: 'introduction_follow_up.created',
        actorIdentityId: identity.id,
        followUpId: data.id,
        introductionId: created.introductionId,
        status: created.status,
        occurredAt: options.now ?? new Date(),
      }),
    );

    return { ok: true, data: created };
  } catch (error) {
    const authFailure = toSafeAuthFailureResult(error);
    if (
      authFailure.error !== 'forbidden' ||
      (error instanceof Error && error.message === 'forbidden')
    ) {
      return authFailure;
    }
    return {
      ok: false,
      error: 'validation',
      message: error instanceof Error ? error.message : 'Unable to create follow-up reminder.',
    };
  }
}

export async function listDueIntroductionFollowUpsAction(
  options: { supabase?: IntroductionFollowUpActionClient; now?: Date } = {},
): Promise<IntroductionFollowUpActionResult<IntroductionFollowUp[]>> {
  const supabase = options.supabase ?? getServerActionClient();

  try {
    const identity = await requireCurrentTrustedIdentity(supabase);
    const query = supabase
      .from('introduction_follow_ups')
      .select('*')
      .eq('created_by_identity_id', identity.id)
      .eq('status', 'scheduled')
      .lte('due_at', (options.now ?? new Date()).toISOString());
    const { data, error } = await query.order('due_at', { ascending: true });

    if (error) {
      throw error;
    }

    return {
      ok: true,
      data: (data ?? [])
        .map(rowToFollowUp)
        .filter((followUp: IntroductionFollowUp) => isFollowUpDue(followUp, options.now)),
    };
  } catch (error) {
    return toSafeAuthFailureResult(error);
  }
}

export async function completeIntroductionFollowUpAction(
  followUp: IntroductionFollowUp,
  options: { supabase?: IntroductionFollowUpActionClient; now?: Date } = {},
): Promise<IntroductionFollowUpActionResult<IntroductionFollowUp>> {
  return transitionIntroductionFollowUp(followUp, 'completed', options);
}

export async function skipIntroductionFollowUpAction(
  followUp: IntroductionFollowUp,
  options: { supabase?: IntroductionFollowUpActionClient; now?: Date } = {},
): Promise<IntroductionFollowUpActionResult<IntroductionFollowUp>> {
  return transitionIntroductionFollowUp(followUp, 'skipped', options);
}

async function transitionIntroductionFollowUp(
  followUp: IntroductionFollowUp,
  status: 'completed' | 'skipped',
  options: { supabase?: IntroductionFollowUpActionClient; now?: Date } = {},
): Promise<IntroductionFollowUpActionResult<IntroductionFollowUp>> {
  const supabase = options.supabase ?? getServerActionClient();

  try {
    const identity = await requireCurrentTrustedIdentity(supabase);
    await requireIntroductionAccess(supabase, followUp.introductionId, identity.id);
    const transitioned =
      status === 'completed'
        ? markFollowUpCompleted(followUp, identity.id, options.now)
        : markFollowUpSkipped(followUp, identity.id, options.now);
    const { data, error } = await supabase
      .from('introduction_follow_ups')
      .update({
        status: transitioned.status,
        completed_at: transitioned.completedAt,
        skipped_at: transitioned.skippedAt,
      })
      .eq('id', followUp.id ?? '')
      .select('*')
      .single();

    if (error || !data) {
      throw error ?? new Error('Unable to update follow-up reminder.');
    }

    const updated = rowToFollowUp(data);
    await insertAudit(
      supabase,
      buildFollowUpAuditEvent({
        eventType:
          status === 'completed'
            ? 'introduction_follow_up.completed'
            : 'introduction_follow_up.skipped',
        actorIdentityId: identity.id,
        followUpId: data.id,
        introductionId: updated.introductionId,
        status: updated.status,
        occurredAt: options.now ?? new Date(),
      }),
    );

    return { ok: true, data: updated };
  } catch (error) {
    const authFailure = toSafeAuthFailureResult(error);
    if (
      authFailure.error !== 'forbidden' ||
      (error instanceof Error && error.message === 'forbidden')
    ) {
      return authFailure;
    }
    return {
      ok: false,
      error: 'validation',
      message: error instanceof Error ? error.message : 'Unable to update follow-up reminder.',
    };
  }
}
