import type { NotificationProvider } from './worker/types';

export class NotConfiguredNotificationProvider implements NotificationProvider {
  async deliver() {
    return { ok: false as const, category: 'transient' as const, code: 'provider_not_configured' };
  }
}

export function getNotificationProvider(): NotificationProvider {
  return new NotConfiguredNotificationProvider();
}
