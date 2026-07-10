# Abuse Prevention Launch Review

This repository now includes provider-neutral rate-limit foundations for sensitive server-side entry points. The first adapter is deterministic and in-memory so local development and tests can exercise enforcement without introducing an external vendor or CAPTCHA.

## Protected surfaces

- Invite validation attempts use token-hash-derived, scoped keys and return non-enumerating validation failures when a caller exceeds the configured threshold.
- Invite creation attempts are scoped to the authenticated trusted identity before any invite is persisted.
- Invite redemption attempts are scoped to the authenticated identity and a hashed invite-token identifier before state changes.
- Internal notification worker invocation is rate-limited before authorization checks and continues to return the existing safe `not_found` response for unauthorized or limited callers.

## Privacy requirements

- Rate-limit keys must be scoped and hashed before storage.
- Do not log raw IP addresses, invite tokens, email addresses, cookies, or authorization headers.
- Safe responses should avoid confirming whether an invite token, email address, account, or worker secret exists.

## Remaining launch review items

1. Replace the in-memory adapter with a durable or managed adapter before multi-instance production rollout so limits are shared across instances.
2. Confirm production proxy headers and trust boundaries before using client IP-derived keys beyond coarse abuse controls.
3. Add operational metrics for limited requests that store only scoped bucket names and counts, never raw identifiers.
4. Review thresholds with real traffic during staging and tune separately for validation, creation, redemption, and worker invocation.
5. Add alerting for spikes in limited invite validation and worker invocation attempts.
6. Revisit database and RLS hardening for invite lifecycle operations before launch.
