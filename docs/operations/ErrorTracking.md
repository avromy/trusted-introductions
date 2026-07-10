# Error Tracking and Incident Alerting

Trusted Introductions uses a provider-neutral server-side error reporting contract in `lib/observability/errors`. The contract is intentionally privacy-first: error events include classification, severity, request ID, an optional actor ID only when explicitly allowed, route or operation name, and redacted operational context.

## Provider behavior

- `ERROR_TRACKING_PROVIDER=development` captures events in memory for local development and tests without network calls.
- `ERROR_TRACKING_PROVIDER=disabled` builds redacted events but does not send them to a remote provider.
- When unset, production defaults to `disabled`; non-production defaults to `development`.

No production network adapter is configured yet. Add one behind the provider-neutral interface before enabling vendor delivery.

## Privacy rules

Do not include raw request bodies, resumes, private notes, message bodies, raw form data, cookies, authorization headers, tokens, secrets, email addresses, or phone numbers in error context. The reporter performs automatic redaction for these classes, but callers should still pass only operational identifiers and coarse status fields.

## Reporting helpers

- Use `reportUnexpectedActionError` for unexpected server action or route failures.
- Use `reportRepositoryError` for persistence, Supabase, storage, or query failures.
- Pass `requestId` whenever available.
- Pass `actorId` only with `includeActorId: true` when policy allows user-level correlation.
- Prefer `route` for HTTP surfaces and `operation` for service or repository helpers.

## Incident alerting runbook

1. Triage event severity and classification. Treat `critical` or repeated `repository_error` events as active incidents.
2. Correlate by `requestId`, route, operation, deployment version, and safe structured logs. Do not search for private user content.
3. Check `/api/health`, deployment logs, Supabase status, and recent releases.
4. If user impact is likely, pause risky rollout activity and notify the steward/operator channel with severity, affected surface, start time, and current mitigation.
5. Mitigate by rolling back the release, disabling the affected feature flag, or applying a narrow hotfix.
6. After recovery, document timeline, root cause, privacy review notes, and follow-up actions. Confirm no secrets or private data appeared in logs or error events.
