import { logStructuredEvent } from '@/lib/observability';
import { redactErrorContext } from './redaction';
import type { ErrorClassification, ErrorReportEvent, ErrorReportInput, ErrorReporter, ErrorSeverity } from './types';

export type ErrorTrackingProviderName = 'development' | 'disabled';

export class CapturingErrorReporter implements ErrorReporter {
  readonly events: ErrorReportEvent[] = [];

  async report(input: ErrorReportInput): Promise<ErrorReportEvent> {
    const event = createErrorReportEvent(input);
    this.events.push(event);
    return event;
  }
}

export class DisabledErrorReporter implements ErrorReporter {
  async report(input: ErrorReportInput): Promise<ErrorReportEvent> {
    return createErrorReportEvent(input);
  }
}

export function getErrorTrackingProviderName(env: NodeJS.ProcessEnv = process.env): ErrorTrackingProviderName {
  const configured = env.ERROR_TRACKING_PROVIDER?.trim();
  if (configured === 'development' || configured === 'disabled') return configured;
  return env.NODE_ENV === 'production' ? 'disabled' : 'development';
}

export function createErrorReporter(env: NodeJS.ProcessEnv = process.env): ErrorReporter {
  return getErrorTrackingProviderName(env) === 'development' ? new CapturingErrorReporter() : new DisabledErrorReporter();
}

export function createErrorReportEvent(input: ErrorReportInput): ErrorReportEvent {
  const classification = input.classification ?? classifyError(input.error);
  return {
    name: 'application.error_reported',
    classification,
    severity: input.severity ?? severityForClassification(classification),
    timestamp: (input.timestamp ?? new Date()).toISOString(),
    ...(input.requestId ? { requestId: input.requestId } : {}),
    ...(input.actorId && input.includeActorId ? { actorId: input.actorId } : {}),
    ...(input.route ? { route: input.route } : {}),
    ...(input.operation ? { operation: input.operation } : {}),
    message: safeErrorMessage(input.error),
    context: redactErrorContext(input.context),
  };
}

export async function reportUnexpectedActionError(input: Omit<ErrorReportInput, 'classification'>, reporter = createErrorReporter()): Promise<ErrorReportEvent> {
  const event = await reporter.report({ ...input, classification: 'unexpected_action_error' });
  logErrorReportEvent(event);
  return event;
}

export async function reportRepositoryError(input: Omit<ErrorReportInput, 'classification'>, reporter = createErrorReporter()): Promise<ErrorReportEvent> {
  const event = await reporter.report({ ...input, classification: 'repository_error' });
  logErrorReportEvent(event);
  return event;
}

export function classifyError(error: unknown): ErrorClassification {
  if (error instanceof TypeError || error instanceof ReferenceError || error instanceof SyntaxError) return 'unexpected_action_error';
  if (error instanceof Error && /database|supabase|repository|storage|query/i.test(error.message)) return 'repository_error';
  return 'unknown_error';
}

function severityForClassification(classification: ErrorClassification): ErrorSeverity {
  if (classification === 'repository_error' || classification === 'dependency_error') return 'error';
  if (classification === 'unexpected_action_error' || classification === 'unknown_error') return 'warning';
  return 'info';
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.name;
  return 'UnknownError';
}

function logErrorReportEvent(event: ErrorReportEvent): void {
  logStructuredEvent({
    event: event.name,
    level: event.severity === 'critical' || event.severity === 'error' ? 'error' : 'warn',
    requestId: event.requestId,
    actorId: event.actorId,
    metadata: {
      classification: event.classification,
      route: event.route ?? null,
      operation: event.operation ?? null,
    },
  });
}
