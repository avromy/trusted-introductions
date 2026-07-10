import type { NotificationDeliveryProvider, NotificationDeliveryRequest, NotificationDeliveryResult } from './types';

type DevelopmentProviderMode = 'success' | 'transient_failure' | 'permanent_failure';

export type RecordedDeliveryAttempt = {
  channel: NotificationDeliveryRequest['channel'];
  subjectLength: number;
  hasTextBody: boolean;
  hasHtmlBody: boolean;
  metadataKeys: string[];
};

export type DevelopmentNotificationProvider = NotificationDeliveryProvider & {
  readonly attempts: readonly RecordedDeliveryAttempt[];
};

export function createDevelopmentNotificationProvider(options: { mode?: DevelopmentProviderMode } = {}): DevelopmentNotificationProvider {
  const attempts: RecordedDeliveryAttempt[] = [];
  const mode = options.mode ?? 'success';

  return {
    name: 'development',
    get attempts() {
      return attempts;
    },
    async deliver(request: NotificationDeliveryRequest): Promise<NotificationDeliveryResult> {
      attempts.push(recordSafeAttempt(request));

      if (mode === 'transient_failure') {
        return { status: 'transient_failure', provider: 'development', errorCode: 'development_transient_failure', retryAfterSeconds: 60 };
      }

      if (mode === 'permanent_failure') {
        return { status: 'permanent_failure', provider: 'development', errorCode: 'development_permanent_failure' };
      }

      return { status: 'success', provider: 'development', providerMessageId: `dev-${attempts.length}` };
    },
  };
}

function recordSafeAttempt(request: NotificationDeliveryRequest): RecordedDeliveryAttempt {
  return {
    channel: request.channel,
    subjectLength: request.subject.length,
    hasTextBody: request.textBody.trim().length > 0,
    hasHtmlBody: Boolean(request.htmlBody?.trim()),
    metadataKeys: Object.keys(request.providerMetadata ?? {}).sort(),
  };
}
