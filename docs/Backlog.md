# Backlog

## Now — M3 Matching Foundation

M2 invite-only onboarding is complete for the MVP helper/action layer. The current MVP backlog should start from the persisted onboarding foundation: trusted identities, roles/contribution modes, profiles, privacy settings, invites, and audit events are available for matching workflows to consume.

- Add job seeker request intake with server-side validation, persistence, ownership, and privacy-aware read access.
- Add helper capability intake with contribution mode, capacity, preferences, and visibility rules.
- Define the initial explainable matching model, including required hard filters and human-readable explanation fields.
- Add steward review workflow for proposed matches, including accept, defer, reject, and recalculation states.
- Centralize matching authorization around trusted identity, role, community, request ownership, helper consent, and privacy settings.
- Emit audit events for sensitive matching decisions and status transitions.
- Cover matching helpers, repositories, actions/routes, and review transitions with typechecking, tests, and build validation.

## MVP Remaining After M3

- Introduction workflow from steward-approved matches.
- Follow-up reminders for introductions and stalled help loops.
- Outcome capture for completed, declined, unresponsive, and follow-up-needed introductions.
- Basic community health reporting that avoids exposing private member data.
- Production onboarding UX polish and end-to-end coverage for the persisted onboarding path.

## Completed

### M2 — Invite-only Onboarding Helper/Action Layer

- Added invite lifecycle helpers for hashed invite payload creation, expiration checks, revoked/blocked/redeemed detection, safe validation results, redemption payloads, and revocation payloads.
- Added persisted invite server actions for authorized creation, safe validation, redemption, and revocation.
- Added invite repository helpers for token-hash lookup, insert, redemption, revocation, and inviter-scoped listing.
- Added onboarding state helpers for invite, trusted identity, role/contribution mode, profile, and privacy completion checks with next-route hints.
- Added server onboarding loader support for current user, trusted identity, profile, privacy settings, invitation state, and completion status.
- Added trusted identity action/repository support for signed-in onboarding identity creation or lookup.
- Added profile setup actions and repositories for role/contribution-mode and member context persistence.
- Added privacy settings actions and repositories with restrictive defaults and server-consumable visibility checks.
- Added auth session helpers that expose the current auth identity and signed-in identity requirement.
- Added audit helper/server coverage for invite and sensitive onboarding-style events.
- Added placeholder onboarding route shells for invite, role, profile, privacy, and completion steps.
- Added tests for invite lifecycle, invite actions/repositories, identity onboarding, profile setup, privacy settings, onboarding state/server loading, audit, auth session, and onboarding components.

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

## Later

- Public meet pages.
- Notification scheduling.
- AI-assisted neutral summaries with endorsement safeguards.
- Advanced feature flags.
