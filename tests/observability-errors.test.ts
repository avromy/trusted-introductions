import { describe, expect, it } from 'vitest';

import {
  CapturingErrorReporter,
  DisabledErrorReporter,
  classifyError,
  createErrorReporter,
  getErrorTrackingProviderName,
  redactErrorContext,
  reportRepositoryError,
  reportUnexpectedActionError,
} from '@/lib/observability/errors';

describe('observability error reporting', () => {
  it('redacts contacts, credentials, resumes, notes, messages, and raw form data', () => {
    const context = redactErrorContext({
      comment: 'Reach Jane at jane@example.com or 415-555-1212',
      authorization: 'Bearer abc123',
      cookie: 'session=secret',
      token: 'abc123',
      resumeText: 'candidate resume contents',
      privateNotes: 'sensitive steward note',
      messageBody: 'private message',
      rawFormData: { email: 'user@example.com' },
      nested: { safe: 'ok', secret: 'do-not-log' },
    });

    expect(JSON.stringify(context)).not.toContain('jane@example.com');
    expect(JSON.stringify(context)).not.toContain('415-555-1212');
    expect(JSON.stringify(context)).not.toContain('abc123');
    expect(JSON.stringify(context)).not.toContain('candidate resume contents');
    expect(JSON.stringify(context)).not.toContain('sensitive steward note');
    expect(JSON.stringify(context)).not.toContain('private message');
    expect(context.nested).toEqual({ safe: 'ok', secret: '[REDACTED]' });
  });

  it('classifies common unexpected and repository errors', () => {
    expect(classifyError(new TypeError('Cannot read properties'))).toBe('unexpected_action_error');
    expect(classifyError(new Error('Supabase query failed'))).toBe('repository_error');
    expect(classifyError('plain failure')).toBe('unknown_error');
  });

  it('uses disabled production behavior when no provider is configured', () => {
    expect(getErrorTrackingProviderName({ NODE_ENV: 'production' })).toBe('disabled');
    expect(createErrorReporter({ NODE_ENV: 'production' })).toBeInstanceOf(DisabledErrorReporter);
  });

  it('captures development and test events without network calls', async () => {
    const reporter = new CapturingErrorReporter();
    const event = await reportUnexpectedActionError(
      {
        error: new Error('Sensitive detail jane@example.com'),
        requestId: 'req_123',
        actorId: 'actor_123',
        includeActorId: true,
        route: '/api/health',
        context: { safeCount: 1 },
        timestamp: new Date('2026-07-10T00:00:00.000Z'),
      },
      reporter,
    );

    expect(reporter.events).toHaveLength(1);
    expect(event).toMatchObject({
      classification: 'unexpected_action_error',
      requestId: 'req_123',
      actorId: 'actor_123',
      route: '/api/health',
      context: { safeCount: 1 },
    });
  });

  it('does not include actor IDs unless allowed and never leaks secret messages', async () => {
    const reporter = new CapturingErrorReporter();
    const event = await reportRepositoryError(
      {
        error: new Error('database password=super-secret failed for user@example.com'),
        actorId: 'actor_123',
        operation: 'memberRepository.list',
        context: { apiKey: 'live_key', description: 'token=secret-token' },
      },
      reporter,
    );

    expect(event.actorId).toBeUndefined();
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain('super-secret');
    expect(serialized).not.toContain('user@example.com');
    expect(serialized).not.toContain('live_key');
    expect(serialized).not.toContain('secret-token');
    expect(event.message).toBe('Error');
  });
});
