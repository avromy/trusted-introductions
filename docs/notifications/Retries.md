# Notification retries and dead letters

Notification delivery uses deterministic retry helpers so worker tests can assert exact retry timing. Transient provider failures are retried with capped exponential backoff. Permanent failures and exhausted transient failures move to `dead_letter`.

## Status flow

- `pending`: eligible for worker pickup.
- `processing`: claimed by a worker for one delivery attempt.
- `sent`: provider accepted the notification.
- `retry_scheduled`: transient failure; `nextAttemptAt` identifies the next eligible pickup time.
- `dead_letter`: permanent failure or retry exhaustion; not eligible for normal pickup.

## Retry policy

The default policy allows five attempts, starts with a one-minute delay, and caps delays at one hour. Tests and worker integrations may inject a policy, including deterministic jitter, through the retry helper options. Do not use non-deterministic jitter directly in the helpers.

## Privacy-safe failures

Provider responses can include email addresses, tokens, or message content. Retry metadata stores only a classification, status code, timestamp, attempt count, and terminal flag. Raw provider response text is intentionally ignored.

## Requeue

Dead-letter records may be requeued only by authorized server-side operators (`admin` or `system`). Requeue resets eligible records to `pending`, clears the attempt count, and appends audit-safe metadata with actor, timestamp, reason, and previous attempt count. Non-dead-letter records are not eligible for this helper.
