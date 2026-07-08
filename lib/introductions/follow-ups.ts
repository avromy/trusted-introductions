import type { Database } from '@/types/supabase';

export type IntroductionRow = Database['public']['Tables']['introductions']['Row'];
export type IntroductionFollowUpRow = Database['public']['Tables']['introduction_follow_ups']['Row'];
export type IntroductionFollowUpInsert = Database['public']['Tables']['introduction_follow_ups']['Insert'];
export type IntroductionFollowUpUpdate = Database['public']['Tables']['introduction_follow_ups']['Update'];
export type IntroductionFollowUpStatus = Database['public']['Enums']['introduction_follow_up_status'];

export const OPEN_FOLLOW_UP_STATUSES = ['pending'] as const satisfies readonly IntroductionFollowUpStatus[];
export const TERMINAL_FOLLOW_UP_STATUSES = ['completed', 'skipped'] as const satisfies readonly IntroductionFollowUpStatus[];

export interface CreateIntroductionFollowUpPayloadInput {
  introductionId: string;
  dueAt: Date | string;
  note?: string | null;
  createdByIdentityId: string;
  now?: Date;
}

export interface CompleteIntroductionFollowUpInput {
  status: Extract<IntroductionFollowUpStatus, 'completed' | 'skipped'>;
  actorIdentityId: string;
  now?: Date;
}

function normalizeRequiredId(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function normalizeDate(value: Date | string, label: string): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid date.`);
  }

  return date.toISOString();
}

export function createIntroductionFollowUpPayload(
  input: CreateIntroductionFollowUpPayloadInput,
): IntroductionFollowUpInsert {
  const now = input.now ?? new Date();
  const note = input.note?.trim() || null;

  return {
    introduction_id: normalizeRequiredId(input.introductionId, 'Introduction id'),
    due_at: normalizeDate(input.dueAt, 'Follow-up due date'),
    status: 'pending',
    note,
    created_by_identity_id: normalizeRequiredId(input.createdByIdentityId, 'Creator identity id'),
    completed_at: null,
    completed_by_identity_id: null,
    skipped_at: null,
    skipped_by_identity_id: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

export function createIntroductionFollowUpStatusUpdate(
  input: CompleteIntroductionFollowUpInput,
): IntroductionFollowUpUpdate {
  const now = input.now ?? new Date();
  const actorIdentityId = normalizeRequiredId(input.actorIdentityId, 'Actor identity id');
  const changedAt = now.toISOString();

  if (input.status === 'completed') {
    return {
      status: 'completed',
      completed_at: changedAt,
      completed_by_identity_id: actorIdentityId,
      skipped_at: null,
      skipped_by_identity_id: null,
      updated_at: changedAt,
    };
  }

  if (input.status === 'skipped') {
    return {
      status: 'skipped',
      skipped_at: changedAt,
      skipped_by_identity_id: actorIdentityId,
      completed_at: null,
      completed_by_identity_id: null,
      updated_at: changedAt,
    };
  }

  throw new Error('Follow-up status must be completed or skipped.');
}

export function isIntroductionParticipant(
  introduction: Pick<IntroductionRow, 'requester_identity_id' | 'helper_identity_id' | 'recipient_identity_id'>,
  identityId: string,
): boolean {
  return [
    introduction.requester_identity_id,
    introduction.helper_identity_id,
    introduction.recipient_identity_id,
  ].includes(identityId);
}

export function isDueFollowUp(
  followUp: Pick<IntroductionFollowUpRow, 'due_at' | 'status'>,
  now: Date = new Date(),
): boolean {
  return followUp.status === 'pending' && new Date(followUp.due_at).getTime() <= now.getTime();
}
