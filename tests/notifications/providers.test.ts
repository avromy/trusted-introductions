import { describe, expect, it } from 'vitest';

import {
  createDevelopmentNotificationProvider,
  createDisabledNotificationProvider,
  createNotificationDeliveryProvider,
  deliverWithSafeLogging,
  getNotificationProviderName,
  type EmailDeliveryRequest,
} from '@/lib/notifications/providers';
import type { StructuredLogEvent } from '@/lib/observability';

const request: EmailDeliveryRequest = {
  channel: 'email',
  to: 'recipient@example.com',
  from: 'sender@example.com',
  subject: 'Introduction ready',
  textBody: 'Private message body with recipient@example.com and 555-123-4567',
  htmlBody: '<p>Private message body</p>',
  providerMetadata: { secretToken: 'super-secret', privateContext: 'only for this recipient' },
};

describe('notification delivery providers', () => {
  it('records a successful development email delivery without making network calls', async () => {
    const provider = createDevelopmentNotificationProvider();

    const result = await provider.deliver(request);

    expect(result).toEqual({ status: 'success', provider: 'development', providerMessageId: 'dev-1' });
    expect(provider.attempts).toEqual([
      { channel: 'email', subjectLength: request.subject.length, hasTextBody: true, hasHtmlBody: true, metadataKeys: ['privateContext', 'secretToken'] },
    ]);
    expect(JSON.stringify(provider.attempts)).not.toContain('recipient@example.com');
    expect(JSON.stringify(provider.attempts)).not.toContain('Private message body');
    expect(JSON.stringify(provider.attempts)).not.toContain('super-secret');
  });

  it('uses disabled delivery in unconfigured production environments', async () => {
    expect(getNotificationProviderName({ NODE_ENV: 'production' })).toBe('disabled');
    const provider = createNotificationDeliveryProvider({ NODE_ENV: 'production' });

    await expect(provider.deliver(request)).resolves.toEqual({
      status: 'permanent_failure',
      provider: 'disabled',
      errorCode: 'notification_delivery_disabled',
    });
  });

  it('returns transient failures as typed retryable results', async () => {
    const provider = createDevelopmentNotificationProvider({ mode: 'transient_failure' });

    await expect(provider.deliver(request)).resolves.toEqual({
      status: 'transient_failure',
      provider: 'development',
      errorCode: 'development_transient_failure',
      retryAfterSeconds: 60,
    });
  });

  it('returns permanent failures as typed non-retryable results', async () => {
    const provider = createDevelopmentNotificationProvider({ mode: 'permanent_failure' });

    await expect(provider.deliver(request)).resolves.toEqual({
      status: 'permanent_failure',
      provider: 'development',
      errorCode: 'development_permanent_failure',
    });
  });

  it('emits only privacy-safe structured logging metadata', async () => {
    const logs: StructuredLogEvent[] = [];
    const provider = createDisabledNotificationProvider();

    await deliverWithSafeLogging(provider, request, (entry) => logs.push(entry));

    expect(logs).toHaveLength(2);
    expect(logs.map((log) => log.metadata)).toEqual([
      { channel: 'email', provider: 'disabled', status: 'attempted', errorCode: null, hasProviderMessageId: false },
      {
        channel: 'email',
        provider: 'disabled',
        status: 'permanent_failure',
        errorCode: 'notification_delivery_disabled',
        hasProviderMessageId: false,
      },
    ]);
  });

  it('does not expose message bodies, contact details, secrets, or provider responses in logs', async () => {
    const logs: StructuredLogEvent[] = [];
    const provider = createDevelopmentNotificationProvider();

    await deliverWithSafeLogging(provider, request, (entry) => logs.push(entry));

    const serializedLogs = JSON.stringify(logs);
    expect(serializedLogs).not.toContain(request.to);
    expect(serializedLogs).not.toContain(request.from);
    expect(serializedLogs).not.toContain(request.textBody);
    expect(serializedLogs).not.toContain(request.htmlBody);
    expect(serializedLogs).not.toContain('super-secret');
    expect(serializedLogs).not.toContain('dev-1');
  });
});
