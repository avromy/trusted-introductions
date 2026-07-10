# Notification operations

Notifications use the durable `notification_outbox` table, provider-neutral templates, and provider adapters. Invite delivery, introduction coordination, follow-up reminders, and outcome prompts must enqueue work rather than call a vendor synchronously.

The internal worker endpoint is `POST /api/internal/notifications/outbox`. It requires `Authorization: Bearer <NOTIFICATION_WORKER_SECRET>`, processes a bounded batch, and returns counts only. Logs must never include destinations or message bodies.

Transient failures use capped exponential backoff. Permanent and exhausted failures remain failed for operator review. Optional follow-up and outcome messages must respect notification preferences and unsubscribe state. Plaintext unsubscribe and invite tokens must never be persisted outside the outbound link payload required for delivery.
