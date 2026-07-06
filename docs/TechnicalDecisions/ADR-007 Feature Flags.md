# ADR-007: Feature Flags

## Status

Accepted initially.

## Context

Sensitive workflows such as public pages, matching automation, AI summaries, and steward tools need controlled rollout.

## Decision

Use feature flags for incomplete or sensitive capabilities. Flags should support environment-level and user/cohort-level targeting once implementation begins.

## Consequences

- Risky features can ship disabled.
- Documentation must identify flag-protected behavior.
- CI and tests should cover both enabled and disabled paths for critical flags.
