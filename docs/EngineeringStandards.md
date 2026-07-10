# Engineering Standards

## Priority Order

1. Correctness
2. Security and privacy
3. Clean architecture
4. Operational reliability
5. Maintainability
6. Speed

Speed never justifies a competing abstraction, an unsafe migration, production-reachable mock behavior, or a misleading completion claim.

## Core Rules

- Preserve valuable existing work.
- Do not rewrite the application unless evidence requires it.
- Do not remove working code without explaining what replaces it.
- Use the existing stack and domain boundaries unless an ADR approves a change.
- Keep documentation, application behavior, tests, and schema synchronized.
- Prefer boring, secure, observable architecture.
- Treat implementation on `main` as the source of truth, while verifying that integration is complete.
- Never treat a merged PR or green CI run as proof of production readiness.

## Architecture Rules

- Domain logic belongs in focused `lib/<domain>` modules, not route components.
- Server actions and API routes authenticate, authorize, validate, invoke domain services, and return safe results.
- Repository modules own persistence mapping and database error handling.
- Shared types must have one canonical source.
- New provider integrations must implement an existing provider-neutral contract or include an ADR explaining why the contract changes.
- Background operations must be bounded, idempotent where appropriate, retry-aware, and observable.
- Do not use audit events as primary mutable workflow state.
- Do not introduce production-reachable mocks, sentinel-triggered test backends, or development stores.

## Pull Request Quality Bar

Every PR must provide:

- a precise problem statement and solution;
- explicit scope boundaries;
- dependencies and merge order;
- architecture-fit explanation;
- security and privacy review;
- migration and existing-data impact where relevant;
- failure modes, rollback, and operational behavior;
- exact test commands and results;
- screenshots for user-facing changes;
- accurate documentation updates.

Reviewers must reject PRs that duplicate existing systems, combine unrelated work, preserve obsolete behavior, hide launch-critical follow-up work, or claim production completeness without deployable infrastructure.

## Database Quality Bar

- Migration identifiers must be unique and sequential.
- Migrations should be additive unless a destructive change is explicitly reviewed.
- Enums and constraints must match application contracts exactly.
- Sensitive tables and storage require explicit RLS or object policies.
- Security-definer functions must set a safe search path and restrict execute permissions.
- Queries used by queues, dashboards, or workers require bounded access and supporting indexes.
- Every destructive or data-rewriting operation requires a rehearsal and remediation procedure.

## Testing Quality Bar

Tests must cover meaningful behavior rather than implementation ceremony. Relevant changes require:

- unit tests for domain rules;
- repository or integration tests for persistence mapping;
- authorization and negative-path tests;
- privacy and sensitive-data exclusion tests;
- browser tests for critical user workflows;
- migration and RLS tests against a real Supabase stack before production launch.

A mock-only test suite cannot certify database policy behavior.

## Privacy and Trust Requirements

- Privacy settings override convenience.
- Store invite and unsubscribe tokens as hashes.
- Audit sensitive actions without storing sensitive content in audit metadata.
- Treat resumes, contact information, identity data, private notes, message bodies, and provider responses as sensitive.
- Public, notification, logging, and audit shapes must use explicit allowlists.
- Do not expose private profile information through match explanations.
- Errors should avoid account, token, or membership enumeration.

## AI Requirements

- AI may assist with neutral summaries, suggestions, and explanations.
- AI must not write a helper's personal endorsement.
- AI outputs affecting matching must be explainable and reviewable.
- Generated code receives the same review, test, security, and operational standards as human-written code.
