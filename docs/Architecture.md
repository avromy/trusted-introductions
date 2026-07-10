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

## Open Technical Decisions

The M1 foundation selected the primary web stack and Supabase direction. Remaining implementation decisions should be captured in ADRs before production use where they materially affect safety, privacy, operations, or extensibility:

- Auth flow details and account recovery behavior.
- Invite delivery provider and email template conventions.
- Queue/background job implementation.
- Notification provider and reminder scheduling.
- Feature flag provider and rollout mechanics.

## Sensitive Data Serialization Rules

Sensitive data must be treated as internal-only unless a server-side authorization check explicitly allows disclosure for the current viewer. Public shapes, action return values, audit metadata, and repository mapper output must not expose resume URLs or files, contact information, steward decision notes, helper private notes, outcome notes, or raw introduction message drafts. Safe payloads may include booleans and aggregate metadata such as `hasResume`, `hasNote`, `noteLength`, counts, statuses, and opaque IDs needed for workflow integrity.

Audit event builders must persist only privacy-safe metadata. When a workflow needs accountability for a sensitive field, store a derived signal such as presence, length, domain, status, or timestamp rather than the raw value. Introduction repository contexts are sanitized before writes and reads so raw introduction messages cannot leak through generic context serialization.
