# Introduction coordination notifications

Introduction coordination notifications are enqueued after a steward or admin creates a valid introduction from an approved steward review.

## Outbox convention

The current implementation records notification work as `audit_events` outbox rows with:

- `event_type`: `introduction_coordination_notification.enqueued`
- `subject_table`: `introductions`
- `subject_id`: the introduction id
- `metadata.deliveryStatus`: `pending`
- `metadata.provider`: `null`

No provider-specific sending code is included. A later worker can select pending rows and hand them to an email, SMS, or in-app delivery provider.

## Recipients and templates

Two distinct messages are created for each introduction:

- `introduction_coordination_requester` for the requester.
- `introduction_coordination_helper` for the helper.

Copy is intentionally neutral and factual. It states that an approved helper match or steward-approved introduction is ready for coordination and directs the recipient to coordinate next steps. It does not say that AI or the platform personally endorses either party.

## Privacy boundaries

The notification payload only includes the minimum coordination context:

- introduction id
- request id
- match id
- steward review id
- requester identity id
- helper identity id
- recipient role
- normalized request headline when present
- `messageContentIncluded: false`

The payload must not include private steward notes, resumes, hidden contact fields, raw introduction messages, free-form private notes, or sensitive profile details.

## Idempotency

Before inserting a notification outbox row, orchestration checks for an existing `introduction_coordination_notification.enqueued` row for the same introduction and recipient role. Existing rows suppress duplicates, so repeated action execution does not enqueue duplicate requester or helper coordination messages.
