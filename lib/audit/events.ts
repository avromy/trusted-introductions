import type {
  AuditActor,
  AuditEventPayload,
  AuditMetadata,
  CreateAuditEventPayloadInput,
} from '@/types/audit';
import type { Json } from '@/types/supabase';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function normalizeAuditMetadataValue(value: unknown): Json | undefined {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return Number.isNaN(value) ? null : value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeAuditMetadataValue(item) ?? null);
  }

  if (isPlainObject(value)) {
    return normalizeAuditMetadata(value);
  }

  return String(value);
}

export function normalizeAuditMetadata(metadata?: Record<string, unknown> | null): AuditMetadata {
  if (!metadata) {
    return {};
  }

  return Object.entries(metadata).reduce<AuditMetadata>((normalized, [key, value]) => {
    const normalizedValue = normalizeAuditMetadataValue(value);

    if (normalizedValue !== undefined) {
      normalized[key] = normalizedValue;
    }

    return normalized;
  }, {});
}

export function assertAuditActor(actor: AuditActor): asserts actor is AuditActor {
  if (!actor.id.trim()) {
    throw new Error('Audit actor id is required.');
  }
}

export function createAuditEventPayload(input: CreateAuditEventPayloadInput): AuditEventPayload {
  assertAuditActor(input.actor);

  return {
    event_type: input.eventType,
    actor_type: input.actor.type,
    actor_id: input.actor.id,
    target_type: input.target?.type?.trim() || null,
    target_id: input.target?.id?.trim() || null,
    metadata: normalizeAuditMetadata(input.metadata),
    occurred_at:
      input.occurredAt instanceof Date
        ? input.occurredAt.toISOString()
        : (input.occurredAt ?? new Date().toISOString()),
  };
}
