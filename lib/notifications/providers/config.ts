import { createDevelopmentNotificationProvider } from './development';
import { createDisabledNotificationProvider } from './disabled';
import type { NotificationDeliveryProvider } from './types';

export type NotificationProviderName = 'development' | 'disabled';

export function getNotificationProviderName(env: NodeJS.ProcessEnv = process.env): NotificationProviderName {
  const configuredProvider = env.NOTIFICATION_DELIVERY_PROVIDER?.trim();

  if (configuredProvider === 'development' || configuredProvider === 'disabled') {
    return configuredProvider;
  }

  return env.NODE_ENV === 'production' ? 'disabled' : 'development';
}

export function createNotificationDeliveryProvider(env: NodeJS.ProcessEnv = process.env): NotificationDeliveryProvider {
  const providerName = getNotificationProviderName(env);
  return providerName === 'disabled' ? createDisabledNotificationProvider() : createDevelopmentNotificationProvider();
}
