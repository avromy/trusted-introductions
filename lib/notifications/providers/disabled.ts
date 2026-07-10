import type { NotificationDeliveryProvider, NotificationDeliveryRequest, NotificationDeliveryResult } from './types';

export function createDisabledNotificationProvider(): NotificationDeliveryProvider {
  return {
    name: 'disabled',
    async deliver(_request: NotificationDeliveryRequest): Promise<NotificationDeliveryResult> {
      return { status: 'permanent_failure', provider: 'disabled', errorCode: 'notification_delivery_disabled' };
    },
  };
}
