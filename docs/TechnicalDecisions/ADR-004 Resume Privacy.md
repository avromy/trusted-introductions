# ADR-004: Resume Privacy

## Status

Accepted initially.

## Context

Resumes may contain sensitive personal and career information. Convenience must not override privacy.

## Decision

Resume visibility is explicit, revocable, and enforced server-side. Resume data must not be exposed to helpers, stewards, public pages, or AI workflows unless the user has granted the relevant permission.

## Consequences

- Resume access requires authorization checks.
- Audit events should record sensitive access.
- Match explanations must avoid leaking private resume details.
