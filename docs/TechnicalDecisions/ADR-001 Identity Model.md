# ADR-001: Identity Model

## Status

Accepted initially; revisit during M1 implementation.

## Context

The product depends on trust. A person may contribute as a job seeker, helper, inviter, and steward, but should not have separate fragmented identities.

## Decision

Model one trusted identity per person, with multiple contribution modes attached to that identity.

## Consequences

- Duplicate prevention is a core requirement.
- Role and capability data should attach to the person record.
- Account recovery and email changes need careful verification.
