# Architecture

## Current State

MVP core is complete at the application, persistence, helper/action, and documentation-contract layer. The repository contains a runnable Next.js App Router application foundation with TypeScript, Tailwind CSS, reusable UI primitives, Vitest, ESLint, Prettier, Supabase client/server configuration, and additive Supabase migrations through the introduction workflow.

The implemented MVP covers invite-only onboarding, trusted identity/profile/privacy setup, job seeker request persistence, helper capability persistence, deterministic match suggestion generation, steward review persistence, introduction creation, follow-up reminder helper/action coverage, outcome helper/action coverage, and an end-to-end MVP flow test. Production hardening remains before broad rollout.

## Implemented Foundation

- Next.js App Router web application under `app/`.
- Shared UI primitives under `components/ui/` and onboarding components under `components/onboarding/`.
- TypeScript path aliasing and strict typechecking.
- Tailwind CSS styling foundation.
- Supabase browser and server client helpers.
- Environment variable validation for required app and Supabase settings.
- Supabase migrations for foundation, invite-only onboarding, job seeker requests, helper capabilities, match suggestions, steward reviews, and introductions.
- Real npm scripts for development, typechecking, unit tests, formatting, linting, and production builds.

## Implemented MVP Domain Layers

- **Identity and invitations:** hashed invite tokens, safe invite validation, redemption/revocation actions, trusted identity lookup/creation, session helpers, and audit events.
- **Onboarding and profiles:** contribution-mode selection, profile setup, privacy settings, onboarding completion, and route-state helpers.
- **Matching:** job seeker request models/actions/repositories, helper capability models/actions/repositories, deterministic explainable matching, persisted match suggestions, and steward review decision/persistence helpers.
- **Introductions and outcomes:** introduction creation from approved steward review, follow-up reminder helpers/actions, outcome helpers/actions, and MVP flow coverage from invite through outcome.

## Target System Shape

The product remains a conventional server-rendered web application:

- Web client for onboarding, profiles, matching review, introductions, follow-ups, and outcomes.
- Server-side actions and repository helpers for identity, invitations, privacy, matching, and outcome workflows.
- Supabase PostgreSQL for auditable trust, matching, introduction, and outcome records.
- Background jobs for reminders, match recalculation, and notifications once productionized.
- Email provider for invites, reminders, and introduction coordination.
- Feature flag layer for controlled rollout.

## Core Domains

- Identity: one trusted person record per human.
- Invitations: invite issuance, redemption, expiration, and inviter accountability.
- Profiles: job seeker needs, helper capabilities, privacy settings, and contribution modes.
- Trust graph: who invited whom, steward review, and relationship context.
- Matching: explainable recommendations between seekers and helpers.
- Introductions: human-mediated connection workflow.
- Follow-ups: reminder and completion tracking around introductions.
- Outcomes: tracked help results and privacy-aware reporting inputs.

## Architectural Constraints

- Privacy checks must be enforced server-side.
- Matching must generate reasons that can be shown to stewards and users where appropriate.
- AI may draft neutral summaries or match explanations, but must not write personal endorsements for helpers.
- Public meet pages must be opt-in and revocable.
- Feature flags must protect unfinished or sensitive capabilities.
- Production hardening must extend the current MVP implementation rather than restarting, rescaffolding, or resetting the architecture.

## Current Implementation Focus: Production Hardening

The next implementation phase should harden the MVP core without adding product scope:

- Replace placeholder route shells with production-ready workflow UX.
- Expand RLS policies and authorization tests for all persisted domain tables.
- Add invite delivery, reminders, notifications, retries, and compliance handling.
- Add observability, audit review dashboards, health checks, and runbooks.
- Add browser-level end-to-end tests once finalized route UX is stable.


## Observability and Logging Rules

Production observability uses the structured logger in `lib/observability` for new logging call sites. The logger contract requires every emitted entry to include an event name, severity level, ISO timestamp, and sanitized metadata, with optional request and actor identifiers for correlation.

Logging must follow these privacy rules:

- Log stable event names such as `invite.created` or `matching.recalculated`; do not log raw user-authored text as an event name.
- Include request IDs and actor IDs when available so incidents can be investigated without exposing sensitive content.
- Metadata must be operational and safe: counts, booleans, enum-like status values, IDs already permitted for operators, and timestamps are acceptable.
- Never log private notes, resume contents or excerpts, contact details, message bodies, email addresses, phone numbers, or free-form user-authored correspondence.
- Treat nested metadata with the same rules as top-level metadata; unsafe fields must be redacted before they reach the sink.
- Prefer adding narrow safe metadata fields over passing whole database records, form payloads, or external provider responses into logs.

The logger is intentionally not wired through all application routes yet; new production instrumentation should adopt it incrementally as specific workflows receive observability work.

## Open Technical Decisions

The primary web stack and Supabase direction are selected. Remaining production decisions should be captured in ADRs before launch where they materially affect safety, privacy, operations, or extensibility:

- Account recovery behavior and operational auth support.
- Invite delivery provider and email template conventions.
- Queue/background job implementation.
- Notification provider and reminder scheduling.
- Feature flag provider and rollout mechanics.
- Observability, alerting, incident response, and data-retention policy details.
