# Outcome prompt notifications

Outcome prompt notification orchestration is intentionally helper-only. It prepares privacy-safe outbox messages for a future scheduler or delivery worker, but it does not integrate a real scheduler, email vendor, route, or dashboard.

## Eligibility

A prompt can be queued only when all of the following are true:

- The introduction is in the `ready` status.
- The configured elapsed period has passed since the introduction was created.
- No terminal introduction outcome has already been recorded. Terminal outcomes are `connected`, `opportunity_created`, `not_a_fit`, and `no_response`.
- The recipient is an introduction requester, helper, or creating steward selected by policy.
- The same introduction, recipient, and occurrence key has not already been queued.

## Privacy and template language

Prompt messages use factual, lightweight language: “Please share a quick status update for this introduction when you have a moment.” The orchestration output intentionally excludes existing private outcome notes, confidential participant responses, and raw introduction context.

## Idempotency convention

Each queued prompt carries an idempotency key composed from the notification type, introduction id, recipient identity id, and occurrence key:

```text
introduction_outcome_prompt.request_status_update:{introductionId}:{recipientIdentityId}:{occurrenceKey}
```

Callers should persist that key in their eventual outbox store with a unique constraint. Until that durable outbox exists, tests pass prior queued prompt records into the helper so it can suppress duplicates deterministically.
