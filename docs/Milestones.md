# Milestones

## Current Focus

M2 — Invite-only Onboarding is the active implementation milestone. M1 is complete, and M2 has moved beyond planning into an implemented helper/action foundation. Future work should extend the existing application foundation rather than restarting, rescaffolding, or redesigning the architecture.

## M0 — Repository Operating System

**Status:** Complete

- Create `/docs` source of truth.
- Add initial ADRs.
- Add handoff template.
- Add issue and PR templates.
- Add placeholder CI.

## M1 — Application Foundation

**Status:** Complete

- Choose and document stack.
- Scaffold web app.
- Add package manager and scripts.
- Configure database and migrations.
- Configure authentication foundation.
- Replace placeholder CI with real lint, typecheck, test, and build commands.

## M2 — Invite-only Onboarding

**Status:** Active / Partially implemented

Completed M2 foundation:

- Additive invite-only onboarding database migration.
- Invite lifecycle helpers for hashed token payloads, safe validation, expiration, revocation, blocked, redeemed, and redemption payload states.
- Onboarding state helpers for invite, trusted identity, role/contribution mode, profile, privacy, route hints, and completion calculation.
- Restrictive privacy helper defaults and visibility predicates for public profiles, resumes, contact information, and helper activity.
- Auth session helpers for current identity lookup and required signed-in identity handling.
- Audit helper coverage for sensitive onboarding-style events.
- Placeholder onboarding screens for invite, role, profile, privacy, and completion.

Remaining M2 work:

- Server actions/API routes that call the helper layer for invite creation, validation, redemption, revocation, and onboarding state transitions.
- Persistence for trusted identity creation, role/contribution mode selection, profile setup, and privacy settings.
- Server-side identity/profile/privacy helper expansion so authorization and privacy enforcement are centralized before matching or public-sharing workflows depend on the data.
- Steward/member authorization checks around invite issuance and invite administration.
- Audit event writes for persisted invite and sensitive onboarding mutations.
- End-to-end or integration coverage for the persisted onboarding flow.

## M3 — Matching Foundation

**Status:** Next

- Job seeker request intake.
- Helper capability intake.
- Explainable matching model.
- Steward review workflow.

## M4 — Help and Outcome Tracking

**Status:** Later

- Introduction workflow.
- Follow-up reminders.
- Outcome capture.
- Community health reporting.
