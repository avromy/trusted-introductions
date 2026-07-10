# Invite delivery notifications

Invite creation now coordinates email delivery through an internal notification outbox. The request transaction creates the invite with hash-only token storage, then enqueues a single `invite.delivery` outbox row for asynchronous processing.

## Token handling

The plaintext invite token is used only to construct the outbound `/auth?invite=...` link in the notification payload. It must not be copied into audit metadata, logs, idempotency keys, or general notification metadata. Invitation persistence continues to store only `token_hash`.

## Idempotency

Invite delivery uses `invite-delivery:{inviteId}:created` as the idempotency key. This suppresses duplicate notifications for the same invite-created delivery event while keeping invite reminders or future notification flows separate.

## Transaction boundary

The create-invite action only enqueues a pending outbox record. It does not call an external email provider in the request transaction; provider delivery should be handled by an outbox worker.
