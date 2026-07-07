# Backlog

## Now — M2 Invite-only Onboarding

M2 is underway. The database foundation, placeholder onboarding screens, invite lifecycle helpers, onboarding state helpers, privacy helpers, auth session helpers, and audit helpers are in place. Remaining work should connect these helpers to server actions/API routes and persistence without changing the M1 application architecture.

- Wire invite creation to steward/member-authorized server actions or API routes.
- Wire invite validation, expiration, revocation, already-used, blocked, and redemption states to persisted invitation rows.
- Preserve hashed invite-code handling; plaintext invite tokens may be generated for delivery but must not be stored or returned by validation helpers.
- Connect invite redemption to trusted identity creation and authenticated session requirements.
- Persist role or contribution-mode selection during onboarding.
- Persist initial profile setup for contribution modes and basic member context.
- Persist privacy settings before matching or public sharing workflows become available.
- Continue identity, profile, and privacy server helper work so authorization and privacy enforcement live on the server side before UI workflows depend on them.
- Expand audit events for invite issuance, redemption, revocation, and sensitive onboarding changes as persistence is wired in.
- Cover server actions/API routes and persisted onboarding behavior with typechecking, tests, and build validation.

## Completed

### M2 — Invite-only Onboarding Helper Layer

- Added invite lifecycle helpers for hashed invite payload creation, expiration checks, revoked/blocked/redeemed detection, safe validation results, redemption payloads, and revocation payloads.
- Added onboarding state helpers for invite, trusted identity, role/contribution mode, profile, and privacy completion checks with next-route hints.
- Added restrictive privacy helpers for default visibility and server-consumable public profile, resume, contact, and helper activity checks.
- Added auth session helpers that expose the current auth identity and signed-in identity requirement.
- Added audit helper coverage for sensitive onboarding-style events.
- Added placeholder onboarding route shells for invite, role, profile, privacy, and completion steps.
- Added tests for invite lifecycle, onboarding state, privacy, audit, auth session, and onboarding components.

### M1 — Application Foundation

- Selected and documented the application stack.
- Scaffolded the Next.js App Router application.
- Added package manager metadata and npm scripts.
- Added real typecheck, test, build, lint, and formatting commands.
- Implemented environment configuration validation.
- Added Supabase client/server helpers.
- Added the initial Supabase foundation migration.
- Added reusable UI primitives and placeholder foundation pages.

### M0 — Repository Operating System

- Created `/docs` source of truth.
- Added initial ADRs.
- Added handoff template.
- Added issue and PR templates.
- Added placeholder CI foundation.

## Next — M3 Matching Foundation

- Job seeker request intake.
- Helper capability intake.
- Explainable matching model.
- Steward review workflow.

## Later

- Introduction workflow.
- Follow-up reminders.
- Outcome capture.
- Community health reporting.
- Public meet pages.
- Notification scheduling.
- AI-assisted neutral summaries with endorsement safeguards.
