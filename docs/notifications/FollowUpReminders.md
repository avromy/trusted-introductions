# Follow-up reminder notifications

Scheduled introduction follow-up reminders are queued through the notification outbox instead of being delivered synchronously from the user-facing follow-up action.

## Orchestration contract

1. Identify a persisted reminder occurrence that is `scheduled` and whose `remindAt` is due.
2. Verify the actor is already authorized for the introduction as a steward, admin, requester, helper, or creator.
3. Build one email outbox notification per intended recipient.
4. Persist notifications with idempotency keys in the form `introduction-follow-up-reminder:{reminderId}:{recipientIdentityId}`.
5. Record a privacy-safe `introduction_follow_up_reminder.queued` audit event only after at least one outbox row is newly queued.

Provider delivery and background worker scheduling stay outside this module.

## Privacy rules

Reminder notes are private operational context. They must not be copied into email content, structured logs, audit metadata, provider metadata, or notification payloads. Outbox payloads only include the introduction id, reminder id, and scheduled reminder time.
