# Backlog

## Now — Production Hardening After MVP Core

MVP core is complete: M1 foundation, M2 invite-only onboarding, M3 matching foundation, and M4 introduction/follow-up/outcome loop are reconciled for MVP. The current backlog should avoid adding new product surface area until the implemented MVP paths are hardened for production use.

- Replace placeholder route shells with production-ready UX and copy for onboarding, seeker requests, helper capabilities, steward review, introductions, follow-ups, and outcome capture.
- Add browser-level end-to-end tests for the persisted MVP loop once UX routes are finalized.
- Expand RLS policies and authorization coverage for identity, invite, profile, privacy, seeker request, helper capability, match, review, introduction, follow-up, and outcome access.
- Add operational notifications for invite delivery, introduction coordination, follow-up reminders, and outcome prompts.
- Add observability: structured logs, audit review dashboards, health checks, error tracking, and steward-facing operational reports.
- Add deployment hardening: environment validation in CI/CD, migration runbooks, backup/restore drills, and release rollback guidance.
- Add privacy/security review tasks for sensitive profile, resume, contact, review, introduction, and outcome data.

## Completed

### MVP Core Reconciliation

- Added an MVP flow test covering invite lifecycle, onboarding completion, seeker request creation, helper capability creation, match recalculation, steward review approval, introduction creation, follow-up creation, and outcome capture.
- Updated milestone and API/database documentation to mark M1 complete, M2 complete, M3 complete for MVP, M4 complete for MVP, and MVP core complete.
- Confirmed production hardening remains separate from new feature development.

### M4 — Help and Outcome Tracking for MVP

- Implemented introduction creation through server actions/repositories and persisted introduction rows from approved steward reviews.
- Reconciled follow-up reminder and outcome helper/action coverage in the MVP flow without adding new product features.
- Documented that production UX, durable reminder/outcome workflow tables, notification scheduling, and operational reporting remain hardening work.

### M3 — Matching Foundation for MVP

- Added job seeker request validation, normalization, safe serialization, repository mapping, persistence coverage, and server-action shape.
- Added helper capability normalization, availability/capacity handling, safe serialization, and test coverage.
- Added explainable matching engine helpers with deterministic scoring and explanations.
- Added steward review decision helpers and audit-safe event payload coverage.

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
- Notification scheduling beyond MVP reminders.
- AI-assisted neutral summaries with endorsement safeguards.
- Advanced feature flags.
- Advanced analytics after privacy review.
