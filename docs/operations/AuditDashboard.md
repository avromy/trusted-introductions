# Audit dashboard operations

The steward audit dashboard is available at `/steward/audit` for identities with the `steward` or `admin` role.

## Intended use

Use this dashboard for narrowly scoped operational review of audit events during support, release verification, and incident triage. It is not an analytics surface and intentionally avoids charts, broad reporting, or user workflow metrics.

## Privacy guardrails

The dashboard displays event type, identity actor id, target table/id, community id, timestamps, and allowlisted scalar metadata only. It must not display private notes, resume contents, contact information, raw form submissions, message bodies, tokens, or other secret values.

## Filters and retention window

Supported filters are event type, actor type, target type, start date, and end date. The default date window is 30 days, and requests are bounded to at most 90 days with page sizes capped at 50 rows.

## Access checks

All access is checked server-side with steward/admin authorization before audit rows are loaded. Unauthorized users see an explicit denial state and no audit data.
