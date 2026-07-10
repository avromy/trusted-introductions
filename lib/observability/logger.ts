export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type SafeMetadataValue = string | number | boolean | null | SafeMetadataValue[] | { [key: string]: SafeMetadataValue };
export type SafeMetadata = Record<string, SafeMetadataValue>;

export type StructuredLogEvent = {
  event: string;
  level: LogLevel;
  timestamp: string;
  requestId?: string;
  actorId?: string;
  metadata: SafeMetadata;
};

export type StructuredLogInput = {
  event: string;
  level?: LogLevel;
  metadata?: Record<string, unknown>;
  requestId?: string;
  actorId?: string;
  timestamp?: Date;
};

type LogSink = (entry: StructuredLogEvent) => void;

const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_PATTERNS = [
  /private.*note/i,
  /^notes?$/i,
  /resume/i,
  /contact/i,
  /email/i,
  /phone/i,
  /message.*bod(y|ies)/i,
  /^body$/i,
  /^content$/i,
];

const CONTACT_VALUE_PATTERNS = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/,
];

export function createStructuredLogEvent(input: StructuredLogInput): StructuredLogEvent {
  const event = input.event.trim();

  if (!event) {
    throw new Error('Structured log event name is required.');
  }

  return {
    event,
    level: input.level ?? 'info',
    timestamp: (input.timestamp ?? new Date()).toISOString(),
    ...(input.requestId ? { requestId: input.requestId } : {}),
    ...(input.actorId ? { actorId: input.actorId } : {}),
    metadata: sanitizeMetadata(input.metadata ?? {}),
  };
}

export function logStructuredEvent(input: StructuredLogInput, sink: LogSink = defaultLogSink): StructuredLogEvent {
  const entry = createStructuredLogEvent(input);
  sink(entry);
  return entry;
}

export function sanitizeMetadata(metadata: Record<string, unknown>): SafeMetadata {
  const sanitized: SafeMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    sanitized[key] = sanitizeMetadataValue(key, value);
  }

  return sanitized;
}

function sanitizeMetadataValue(key: string, value: unknown): SafeMetadataValue {
  if (isSensitiveKey(key)) {
    return REDACTED;
  }

  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return null;
  }

  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }

  if (typeof value === 'string') {
    return containsContactDetail(value) ? REDACTED : value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadataValue(key, item));
  }

  if (typeof value === 'object') {
    return sanitizeMetadata(value as Record<string, unknown>);
  }

  return null;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function containsContactDetail(value: string): boolean {
  return CONTACT_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function defaultLogSink(entry: StructuredLogEvent): void {
  const writer = entry.level === 'error' ? console.error : entry.level === 'warn' ? console.warn : console.log;
  writer(JSON.stringify(entry));
}
