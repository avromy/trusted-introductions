import type { NotificationDeliveryProvider, NotificationDeliveryRequest, NotificationDeliveryResult } from './types';

export function createResendNotificationProvider(env: NodeJS.ProcessEnv = process.env): NotificationDeliveryProvider {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.NOTIFICATION_FROM_EMAIL?.trim();

  return {
    name: 'resend',
    async deliver(request: NotificationDeliveryRequest): Promise<NotificationDeliveryResult> {
      if (!apiKey || !from) {
        return { status: 'permanent_failure', provider: 'resend', errorCode: 'provider_not_configured' };
      }

      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: request.from ?? from,
            to: [request.to],
            subject: request.subject,
            text: request.textBody,
            ...(request.htmlBody ? { html: request.htmlBody } : {}),
          }),
        });

        if (response.ok) {
          const body = (await response.json().catch(() => ({}))) as { id?: string };
          return { status: 'success', provider: 'resend', ...(body.id ? { providerMessageId: body.id } : {}) };
        }

        if (response.status === 429 || response.status >= 500) {
          const retryAfter = Number(response.headers.get('retry-after') ?? '0');
          return {
            status: 'transient_failure',
            provider: 'resend',
            errorCode: `http_${response.status}`,
            ...(Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterSeconds: retryAfter } : {}),
          };
        }

        return { status: 'permanent_failure', provider: 'resend', errorCode: `http_${response.status}` };
      } catch {
        return { status: 'transient_failure', provider: 'resend', errorCode: 'network_error' };
      }
    },
  };
}
