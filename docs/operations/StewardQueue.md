# Steward operational queue

The steward queue at `/steward/operations` summarizes existing workflow records that need human action. It is steward/admin-only and reuses the existing server-side authorization helper.

## Included queue groups

- Requests awaiting match review from existing request and match suggestion records.
- Reviews needing information from `needs_info` steward reviews.
- Approved matches awaiting introduction when an approved review has no introduction record.
- Introductions needing follow-up when ready introductions have no scheduled follow-up audit event.
- Introductions awaiting outcome when completed introductions have no outcome audit event.

## Privacy boundary

The dashboard intentionally shows only workflow identifiers, public request headlines, statuses, counts, timestamps, and links to existing workflow routes. It must not show private helper notes, seeker private details, resumes, hidden contact information, private outcome notes, or notification delivery status.
