export type NotificationDeliveryChannel = 'email';

export type EmailDeliveryRequest = {
  channel: 'email';
  to: string;
  from?: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  providerMetadata?: Record<string, unknown>;
};

export type NotificationDeliveryRequest = EmailDeliveryRequest;

export type NotificationDeliverySuccess = {
  status: 'success';
  provider: string;
  providerMessageId?: string;
};

export type NotificationDeliveryTransientFailure = {
  status: 'transient_failure';
  provider: string;
  errorCode: string;
  retryAfterSeconds?: number;
};

export type NotificationDeliveryPermanentFailure = {
  status: 'permanent_failure';
  provider: string;
  errorCode: string;
};

export type NotificationDeliveryResult =
  | NotificationDeliverySuccess
  | NotificationDeliveryTransientFailure
  | NotificationDeliveryPermanentFailure;

export type NotificationDeliveryProvider = {
  readonly name: string;
  deliver(request: NotificationDeliveryRequest): Promise<NotificationDeliveryResult>;
};
