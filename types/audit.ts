import type { Json } from './supabase';

export const AUDIT_EVENT_TYPES = [
  'invite.created',
  'invite.sent',
  'invite.accepted',
  'invite.revoked',
  'onboarding.started',
  'onboarding.completed',
  'privacy_settings.updated',
  'job_seeker_request.created',
  'helper_capability.upserted',
  'steward_match_review.approved',
  'steward_match_review.rejected',
  'steward_match_review.needs_info',
  'steward_match_review.recalculated',
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export const AUDIT_ACTOR_TYPES = ['user', 'system'] as const;

export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export type AuditMetadata = Record<string, Json>;

export interface AuditActor {
  type: AuditActorType;
  id: string;
}

export interface AuditEventPayload {
  event_type: AuditEventType;
  actor_type: AuditActorType;
  actor_id: string;
  target_type: string | null;
  target_id: string | null;
  metadata: AuditMetadata;
  occurred_at: string;
}

export interface CreateAuditEventPayloadInput {
  eventType: AuditEventType;
  actor: AuditActor;
  target?: {
    type?: string | null;
    id?: string | null;
  };
  metadata?: Record<string, unknown> | null;
  occurredAt?: Date | string;
}
