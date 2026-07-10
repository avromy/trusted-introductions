import { createDevelopmentNotificationProvider } from './development';
import { createDisabledNotificationProvider } from './disabled';
import { createResendNotificationProvider } from './resend';
import type { NotificationDeliveryProvider } from './types';

export type NotificationProviderName = 'development' | 'disabled' | 'resend';

export function getNotificationProviderName(env: NodeJS.ProcessEnv = process.env): NotificationProviderName {
  const configuredProvider = env.NOTIFICATION_DELIVERY_PROVIDER?.trim();
  if (configuredProvider === 'development' || configuredProvider === 'disabled' || configuredProvider === 'resend') {
    return configuredProvider;
  }
  return env.NODE_ENV === 'production' ? 'disabled' : 'development';
}

export function createNotificationDeliveryProvider(env: NodeJS.ProcessEnv = process.env): NotificationDeliveryProvider {
  const providerName = getNotificationProviderName(env);
  if (providerName === 'resend') return createResendNotificationProvider(env);
  if (providerName === 'disabled') return createDisabledNotificationProvider();
  return createDevelopmentNotificationProvider();
}
