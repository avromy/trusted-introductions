# Milestones

## Current Focus

M2 — Invite-only Onboarding is complete at the MVP helper/action layer. M1 application foundation is complete, and the product now has persisted onboarding server actions for invites, trusted identity creation, role/contribution mode selection, profile setup, privacy settings, and onboarding state loading. Current MVP work should move forward from this foundation into M3 matching and the M4 introduction/outcome loop instead of rebuilding onboarding primitives.

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

**Status:** Complete for MVP foundation

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
- Unit/integration coverage for invite lifecycle, invite actions/repositories, identity onboarding, profile setup, privacy settings, onboarding state/server loading, audit, auth session, and onboarding components.

M2 follow-up hardening that can happen alongside later MVP work:

- Replace placeholder onboarding screens with production UX and delivery copy.
- Add end-to-end browser coverage for the full persisted onboarding path once the UX is finalized.
- Expand RLS policies beyond the current MVP table-level foundation.
- Add operational invite delivery and resend flows when notification infrastructure exists.

## M3 — Matching Foundation

**Status:** Current MVP remaining work / Next

Matching is not yet implemented in application code or database schema. M3 should build on M2 identity, profile, privacy, role, and audit foundations.

Remaining M3 scope:

- Job seeker request intake.
- Helper capability intake.
- Explainable matching model.
- Steward review workflow.
- Permission and privacy enforcement around request visibility, helper visibility, and match explanations.
- Tests for matching scoring/explanations, review transitions, and privacy-safe access.

## M4 — Help and Outcome Tracking

**Status:** MVP remaining work / Later

- Introduction workflow.
- Follow-up reminders.
- Outcome capture.
- Community health reporting.
