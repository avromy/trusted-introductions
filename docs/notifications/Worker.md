# Notification outbox worker

The notification outbox worker performs one bounded delivery pass over `notification_outbox` rows. It is designed for an external scheduler, not ordinary signed-in users.

## Invocation

Configure a server-only secret in the deployment environment:

```bash
NOTIFICATION_WORKER_SECRET="a long random value"
```

External schedulers should invoke the internal endpoint with `POST` and either the dedicated header or a bearer token:

```bash
curl -X POST \
  -H "x-notification-worker-secret: $NOTIFICATION_WORKER_SECRET" \
  https://your-app.example.com/api/internal/notifications/outbox
```

The route returns counts only: claimed, delivered, transient failure, permanent failure, skipped-by-boundary, and duration. It never returns destination addresses or message bodies.

## Bounds and concurrency

- `NOTIFICATION_WORKER_BATCH_SIZE` controls the per-pass batch size and is capped at 100.
- `NOTIFICATION_WORKER_MAX_DURATION_MS` controls the per-pass execution budget and is capped at 60 seconds.
- The worker first selects eligible `pending` rows, then transitions only still-`pending` rows to `processing` with a worker lock. Completion updates require the same `locked_by` value so stale workers do not overwrite another worker's state.

## Failure handling

Provider failures are classified as `transient` or `permanent`. Transient failures return records to `pending` with exponential retry metadata. Permanent failures move records to `failed`. Exhausted retries are treated as permanent.

## Logging

Structured logs include only safe fields: worker id, record id, counts, categories, statuses, failure codes, and durations. Do not add destination addresses, rendered templates, or message bodies to worker logs.
