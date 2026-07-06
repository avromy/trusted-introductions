# ADR-006: Public Meet Pages

## Status

Accepted initially; implementation deferred.

## Context

Public meet pages may help seekers share a curated introduction page, but they can also leak sensitive identity and career information.

## Decision

Public meet pages are opt-in, privacy-limited, revocable, and excluded from MVP until core identity and privacy controls are implemented.

## Consequences

- Public pages require explicit enablement.
- Pages must never expose resume/contact fields beyond selected visibility.
- Revocation should take effect immediately.
