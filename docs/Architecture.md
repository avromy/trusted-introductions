# Architecture

## Current State

M1 — Application Foundation is complete. The repository now contains a runnable Next.js App Router application foundation with TypeScript, Tailwind CSS, reusable UI primitives, Vitest, ESLint, Prettier, Supabase client/server configuration, and an initial Supabase foundation migration.

The application intentionally remains workflow-light: current pages and tests validate the foundation, navigation shape, and environment configuration without adding invite, profile, matching, introduction, or outcome business logic. M2 — Invite-only Onboarding is the current implementation focus.

## Implemented Foundation

- Next.js App Router web application under `app/`.
- Shared UI primitives under `components/ui/`.
- TypeScript path aliasing and strict typechecking.
- Tailwind CSS styling foundation.
- Supabase browser and server client helpers.
- Environment variable validation for required app and Supabase settings.
- Initial Supabase migration that enables `pgcrypto` and creates the private resume storage bucket.
- Real npm scripts for development, typechecking, unit tests, formatting, linting, and production builds.

## Target System Shape

A conventional web application is expected:

- Web client for onboarding, profiles, matching review, introductions, and outcomes.
- Server-side API for identity, invitations, privacy, matching, and outcome workflows.
- Relational database for auditable trust and outcome records.
- Background jobs for reminders, match recalculation, and notifications.
- Email provider for invites, reminders, and introduction coordination.
- Feature flag layer for controlled rollout.

## Core Domains

- Identity: one trusted person record per human.
- Invitations: invite issuance, redemption, expiration, and inviter accountability.
- Profiles: job seeker needs, helper capabilities, privacy settings, and contribution modes.
- Trust graph: who invited whom, steward review, and relationship context.
- Matching: explainable recommendations between seekers and helpers.
- Introductions: human-mediated connection workflow.
- Outcomes: tracked help results and follow-up status.

## Architectural Constraints

- Privacy checks must be enforced server-side.
- Matching must generate reasons that can be shown to stewards and users where appropriate.
- AI may draft neutral summaries or match explanations, but must not write personal endorsements for helpers.
- Public meet pages must be opt-in and revocable.
- Feature flags must protect unfinished or sensitive capabilities.
- M2 onboarding work must extend the existing foundation rather than restarting, rescaffolding, or resetting the architecture.

## Current Implementation Focus: M2 Invite-only Onboarding

M2 should add the first product workflow on top of the completed foundation:

- Invite creation and redemption.
- Trusted identity creation.
- Initial profile setup.
- Privacy settings.

M2 should preserve the accepted product decisions in the ADRs, especially the one-person identity model, accountable invite graph, server-enforced privacy, and hashed invite-code handling.


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

The M1 foundation selected the primary web stack and Supabase direction. Remaining implementation decisions should be captured in ADRs before production use where they materially affect safety, privacy, operations, or extensibility:

- Auth flow details and account recovery behavior.
- Invite delivery provider and email template conventions.
- Queue/background job implementation.
- Notification provider and reminder scheduling.
- Feature flag provider and rollout mechanics.
