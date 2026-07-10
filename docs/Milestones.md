# Milestones

## Current Focus

MVP core is complete at the helper/action and documentation-contract layer. M1 and M2 are complete, M3 is complete for the MVP matching foundation, and M4 is complete for the MVP introduction/follow-up/outcome loop. Remaining work is production hardening: polished UX, operational notifications, stricter RLS/access policies, observability, deployment readiness, and broader browser/e2e coverage.

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

**Status:** Complete for MVP

Completed M2 scope:

- Additive invite-only onboarding database migration for trusted identities, communities, roles, invitations, affiliations, privacy settings, and audit events.
- Invite lifecycle helpers for hashed token payloads, safe validation, expiration, revocation, blocked, redeemed, and redemption payload states.
- Persisted invite server actions for authorized invite creation, safe validation, redemption, and revocation.
- Invite repository helpers that preserve hash-only token storage and return plaintext tokens only during creation.
- Onboarding state helpers for invite, trusted identity, role/contribution mode, profile, privacy, route hints, and completion calculation.
- Server-side onboarding loader that composes auth, trusted identity, profile, privacy settings, invite state, and completion status.
- Trusted identity action/repository support for signed-in invite redemption and identity creation or lookup.
- Role/contribution-mode, profile setup, and privacy settings actions backed by persistence.
- Restrictive privacy helper defaults and visibility predicates for public profiles, resumes, contact information, helper activity, AI summaries, and public meet pages.
- Auth session helpers for current identity lookup and required signed-in identity handling.
- Audit helper/server coverage for invite and sensitive onboarding mutations.
- Placeholder onboarding screens for invite, role, profile, privacy, and completion.
- Unit/integration coverage for invite lifecycle, invite actions/repositories, identity onboarding, profile setup, privacy settings, onboarding state/server loading, audit, auth session, onboarding components, and the reconciled MVP flow.

## M3 — Matching Foundation

**Status:** Complete for MVP

Completed MVP matching scope:

- Job seeker request model, validation, normalization, safe serialization, repository mapping, and persistence coverage.
- Helper capability model, category/availability normalization, capacity checks, private-note stripping, and helper capability coverage.
- Deterministic explainable matching engine with help type, company, industry, community, availability, relationship strength, opt-out, and unavailable-helper handling.
- Steward review decision helpers for approval, rejection, needs-info transitions, final-status protection, assigned-steward enforcement, and safe audit payloads.
- End-to-end MVP flow test coverage that ties request creation, helper capability creation, match recalculation, and steward approval together.

## M4 — Help and Outcome Tracking

**Status:** Complete for MVP

Completed MVP loop scope:

- Introduction creation is implemented through server actions/repositories and persisted introduction rows from a steward-approved match.
- Follow-up reminder helpers/actions are covered for the created introduction.
- Outcome helpers/actions are covered for completed connection capture.
- The MVP flow and introduction workflow tests verify the core loop from invite through outcome without adding new product features.

## MVP Core

**Status:** Complete

The core MVP loop is covered by implementation helpers, action/repository tests, and `tests/mvp-flow.test.ts`:

> Invite → Onboard → Seeker request → Helper capability → Match recalculation → Steward review → Introduction → Follow-up → Outcome

## Production Hardening Remaining

- Replace placeholder screens and route shells with production-ready onboarding, matching, review, introduction, follow-up, and outcome UX.
- Add browser-level end-to-end coverage for the full persisted flow after UX routes are finalized.
- Expand RLS policies and authorization tests beyond the MVP table-level foundation.
- Add operational invite delivery, reminder scheduling, notification templates, retries, and unsubscribe/compliance handling.
- Add production observability, dashboards, structured logs, alerting, and runbooks.
- Add reporting that summarizes community health without exposing private member data.
- Run load, abuse-prevention, privacy, and security reviews before broader rollout.
