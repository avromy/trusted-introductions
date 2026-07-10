import { logStructuredEvent, type StructuredLogEvent } from '@/lib/observability';

import type { NotificationDeliveryProvider, NotificationDeliveryRequest, NotificationDeliveryResult } from './types';

type NotificationLogSink = (entry: StructuredLogEvent) => void;

export async function deliverWithSafeLogging(
  provider: NotificationDeliveryProvider,
  request: NotificationDeliveryRequest,
  sink?: NotificationLogSink,
): Promise<NotificationDeliveryResult> {
  logDeliveryEvent('notification.delivery.attempted', provider.name, request, undefined, sink);
  const result = await provider.deliver(request);
  logDeliveryEvent('notification.delivery.completed', provider.name, request, result, sink);
  return result;
}

function logDeliveryEvent(
  event: string,
  providerName: string,
  request: NotificationDeliveryRequest,
  result?: NotificationDeliveryResult,
  sink?: NotificationLogSink,
): void {
  logStructuredEvent(
    {
      event,
      level: result?.status === 'transient_failure' ? 'warn' : result?.status === 'permanent_failure' ? 'error' : 'info',
      metadata: {
        channel: request.channel,
        provider: providerName,
        status: result?.status ?? 'attempted',
        errorCode: result && result.status !== 'success' ? result.errorCode : null,
        hasProviderMessageId: result?.status === 'success' ? Boolean(result.providerMessageId) : false,
      },
    },
    sink,
  );
}
