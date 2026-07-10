import { describe, expect, it } from 'vitest';

import { createStructuredLogEvent, logStructuredEvent, sanitizeMetadata } from '@/lib/observability';

describe('observability logger', () => {
  it('creates structured log events with production fields', () => {
    const entry = createStructuredLogEvent({
      event: 'invite.created',
      level: 'info',
      requestId: 'req-123',
      actorId: 'actor-456',
      timestamp: new Date('2026-07-10T12:00:00.000Z'),
      metadata: { inviteCount: 1, stewardReview: true },
    });

    expect(entry).toEqual({
      event: 'invite.created',
      level: 'info',
      timestamp: '2026-07-10T12:00:00.000Z',
      requestId: 'req-123',
      actorId: 'actor-456',
      metadata: { inviteCount: 1, stewardReview: true },
    });
  });

  it('redacts private notes, resumes, contact details, and message bodies', () => {
    const metadata = sanitizeMetadata({
      privateNote: 'Only for the steward',
      resumeContents: 'Full resume text',
      contactDetails: { email: 'person@example.com', phone: '555-123-4567' },
      messageBody: 'Thanks for making the introduction.',
      nested: { emailAddress: 'helper@example.com', safeReason: 'industry match' },
      freeText: 'Reach me at 555-987-6543',
    });

    expect(metadata).toEqual({
      privateNote: '[REDACTED]',
      resumeContents: '[REDACTED]',
      contactDetails: '[REDACTED]',
      messageBody: '[REDACTED]',
      nested: { emailAddress: '[REDACTED]', safeReason: 'industry match' },
      freeText: '[REDACTED]',
    });
  });

  it('normalizes safe metadata into JSON-safe values', () => {
    const metadata = sanitizeMetadata({
      safeString: 'match accepted',
      safeNumber: 2,
      safeBoolean: false,
      safeDate: new Date('2026-07-11T00:00:00.000Z'),
      nested: { undefinedValue: undefined, nanValue: Number.NaN },
      list: ['ok', undefined, new Date('2026-07-12T00:00:00.000Z')],
    });

    expect(metadata).toEqual({
      safeString: 'match accepted',
      safeNumber: 2,
      safeBoolean: false,
      safeDate: '2026-07-11T00:00:00.000Z',
      nested: { undefinedValue: null, nanValue: null },
      list: ['ok', null, '2026-07-12T00:00:00.000Z'],
    });
  });

  it('emits through an injectable sink without wiring app routes', () => {
    const events: unknown[] = [];

    const entry = logStructuredEvent(
      { event: 'matching.recalculated', level: 'debug', metadata: { candidateCount: 3 } },
      (logEntry) => events.push(logEntry),
    );

    expect(events).toEqual([entry]);
  });
});
