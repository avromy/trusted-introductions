import type { SafeMetadata, SafeMetadataValue } from '@/lib/observability';

export const REDACTED_ERROR_VALUE = '[REDACTED]';

const SENSITIVE_KEY_PATTERNS = [
  /authorization/i,
  /cookie/i,
  /secret/i,
  /token/i,
  /api[-_]?key/i,
  /password/i,
  /resume/i,
  /private.*note/i,
  /^notes?$/i,
  /message.*bod(y|ies)/i,
  /^message$/i,
  /^body$/i,
  /^content$/i,
  /raw.*form/i,
  /^formData$/i,
  /email/i,
  /phone/i,
];

const VALUE_PATTERNS = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g,
  /\b(?:bearer|basic)\s+[A-Z0-9._~+/=-]+/gi,
  /\b(?:token|secret|password|api[-_]?key)=([^\s&]+)/gi,
];

export function redactErrorContext(context: Record<string, unknown> = {}): SafeMetadata {
  const redacted: SafeMetadata = {};
  for (const [key, value] of Object.entries(context)) {
    redacted[key] = redactValue(key, value);
  }
  return redacted;
}

function redactValue(key: string, value: unknown): SafeMetadataValue {
  if (isSensitiveKey(key)) return REDACTED_ERROR_VALUE;
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return null;
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(key, item));
  if (typeof value === 'object') return redactErrorContext(value as Record<string, unknown>);
  return null;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function redactString(value: string): string {
  return VALUE_PATTERNS.reduce((current, pattern) => current.replace(pattern, REDACTED_ERROR_VALUE), value);
}
