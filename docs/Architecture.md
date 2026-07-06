# Architecture

## Current State

No runnable application exists yet. The repository currently contains documentation, templates, and placeholder CI. The first implementation milestone is to scaffold an application without rewriting or discarding future work.

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

## Open Technical Decisions

- Web framework and hosting platform.
- Auth provider versus custom auth.
- Database provider and migration tooling.
- Queue/background job implementation.
- Email and notification provider.

These decisions should be captured in ADRs before production implementation.
