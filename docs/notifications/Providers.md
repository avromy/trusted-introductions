# Notification Delivery Providers

Trusted Introductions uses a provider-neutral notification delivery abstraction for operational notifications. This task only introduces the delivery contract and safe test/development implementations; it does **not** add an outbox worker or change the notification outbox schema.

## Current providers

- `development`: a safe local/test provider that records privacy-safe delivery attempt metadata in memory and never makes network calls.
- `disabled`: the production-safe fallback for unconfigured environments. Delivery returns a typed permanent failure with `notification_delivery_disabled`.

`NOTIFICATION_DELIVERY_PROVIDER` may be set to `development` or `disabled`. When it is unset, non-production environments use `development` and production uses `disabled`.

## Delivery contract

Adapters implement `NotificationDeliveryProvider` from `lib/notifications/providers` and return one typed result:

- `success`: delivery was accepted by the provider.
- `transient_failure`: retryable provider or network failure. Include a stable `errorCode` and optional `retryAfterSeconds`.
- `permanent_failure`: non-retryable configuration, policy, or request failure. Include a stable `errorCode`.

The initial supported channel is email through `EmailDeliveryRequest`.

## Privacy and logging requirements

Provider adapters must never log or persist message bodies, email addresses, phone numbers, private context, secrets, or raw provider responses containing personal data. Use `deliverWithSafeLogging` to emit structured events with only safe metadata: channel, provider name, typed status, stable error code, and whether a provider message id exists.

## Adding a real provider later

1. Create a new adapter under `lib/notifications/providers` that implements `NotificationDeliveryProvider`.
2. Map the external vendor response into the typed provider-neutral result union. Do not expose raw vendor payloads from the adapter.
3. Add vendor-neutral environment hooks to select the adapter without requiring the vendor for local development or tests.
4. Keep secrets in server-only environment variables and never include them in logs, thrown errors, or recorded attempts.
5. Add unit tests for success, transient failure, permanent failure, disabled configuration, safe logging, and secret redaction.
6. Wire any future worker to this abstraction rather than calling a vendor SDK directly.
