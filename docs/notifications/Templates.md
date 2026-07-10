# Notification templates

Trusted Introductions notification templates are provider-neutral domain contracts. They prepare content for a future delivery adapter, but they do not send email, enqueue jobs, or write database rows.

## Categories

The notification domain currently supports four categories:

- `invite_delivery` for invite delivery messages.
- `introduction_coordination` for participant coordination around an introduction.
- `follow_up_reminder` for scheduled introduction follow-up reminders.
- `outcome_prompt` for prompting participants to record an outcome.

## Message contract

Every template builder returns a `NotificationMessage` with:

- `category`, one of the supported notification categories.
- `recipient`, either an identity reference or a delivery-address reference.
- `subject` and `textBody`.
- Optional `htmlBody` generated from the same neutral text.
- Privacy-safe `metadata` limited to identifiers, template version names, booleans, counts, and timestamps needed for operations.
- `idempotencyKey` for safe retries by a future provider adapter.

## Privacy rules

Templates must not include private steward notes, resume contents, private messages, compensation details, health information, or raw introduction context. Template metadata should use identifiers and operational flags rather than copied user-provided sensitive text.

Language should stay neutral. It may say that a steward or community member is coordinating an introduction, but it must not imply that a personal endorsement was written by AI.

## Out of scope

This module intentionally does not include a real email provider, scheduler, queue worker, unsubscribe system, or database migrations. Those concerns should be added in separate production-hardening tasks.
