import type { SafeMetadata } from '@/lib/observability';

export type ErrorClassification =
  | 'unexpected_action_error'
  | 'repository_error'
  | 'validation_error'
  | 'authentication_error'
  | 'authorization_error'
  | 'dependency_error'
  | 'unknown_error';

export type ErrorSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export type ErrorReportEvent = {
  name: string;
  classification: ErrorClassification;
  severity: ErrorSeverity;
  timestamp: string;
  requestId?: string;
  actorId?: string;
  route?: string;
  operation?: string;
  message: string;
  context: SafeMetadata;
};

export type ErrorReportInput = {
  error: unknown;
  classification?: ErrorClassification;
  severity?: ErrorSeverity;
  requestId?: string;
  actorId?: string;
  includeActorId?: boolean;
  route?: string;
  operation?: string;
  context?: Record<string, unknown>;
  timestamp?: Date;
};

export type ErrorReporter = {
  report(input: ErrorReportInput): Promise<ErrorReportEvent>;
};
