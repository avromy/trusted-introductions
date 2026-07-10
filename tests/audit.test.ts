import { describe, expect, it } from 'vitest';

import { createAuditEventPayload, normalizeAuditMetadata } from '@/lib/audit';

describe('audit helpers', () => {
  it('creates isolated audit event payloads', () => {
    const payload = createAuditEventPayload({
      eventType: 'invite.created',
      actor: { type: 'user', id: 'user-123' },
      target: { type: 'invite', id: 'invite-456' },
      metadata: { emailDomain: 'example.com' },
      occurredAt: new Date('2026-07-07T12:00:00.000Z'),
    });

    expect(payload).toEqual({
      event_type: 'invite.created',
      actor_type: 'user',
      actor_id: 'user-123',
      target_type: 'invite',
      target_id: 'invite-456',
      metadata: { emailDomain: 'example.com' },
      occurred_at: '2026-07-07T12:00:00.000Z',
    });
  });

  it('requires an audit actor id', () => {
    expect(() =>
      createAuditEventPayload({
        eventType: 'onboarding.started',
        actor: { type: 'user', id: '   ' },
      }),
    ).toThrow('Audit actor id is required.');
  });

  it('normalizes metadata into JSON-safe values', () => {
    const metadata = normalizeAuditMetadata({
      keep: 'value',
      nested: { date: new Date('2026-07-07T00:00:00.000Z'), missing: undefined },
      list: [1, undefined, new Date('2026-07-08T00:00:00.000Z')],
      nan: Number.NaN,
      drop: undefined,
    });

    expect(metadata).toEqual({
      keep: 'value',
      nested: { date: '2026-07-07T00:00:00.000Z' },
      list: [1, null, '2026-07-08T00:00:00.000Z'],
      nan: null,
    });
  });
});

it('redacts sensitive metadata keys before audit persistence', () => {
  const metadata = normalizeAuditMetadata({
    inviteeEmail: 'invitee@example.com',
    resumeUrl: 'https://example.com/private-resume.pdf',
    privateNotes: 'do not log',
    nested: {
      outcomeNote: 'sensitive outcome context',
      noteLength: 25,
    },
    status: 'created',
  });

  expect(metadata).toEqual({
    nested: { noteLength: 25 },
    status: 'created',
  });
  expect(JSON.stringify(metadata)).not.toContain('invitee@example.com');
  expect(JSON.stringify(metadata)).not.toContain('private-resume');
  expect(JSON.stringify(metadata)).not.toContain('do not log');
  expect(JSON.stringify(metadata)).not.toContain('sensitive outcome context');
});
