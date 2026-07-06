# ADR-003: Matching Engine

## Status

Accepted initially.

## Context

The product matches people to trusted access, not jobs. Recommendations must be understandable and reviewable.

## Decision

Build an explainable matching engine that combines seeker needs, helper capabilities, availability, relationship context, and privacy constraints. Keep steward review in the loop for early versions.

## Consequences

- Every match stores a human-readable explanation.
- Privacy settings constrain match inputs and outputs.
- Scoring logic must be testable and auditable.
