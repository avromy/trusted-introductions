# ADR-005: Invite System

## Status

Accepted initially.

## Context

Invites are the entrance to the trust network.

## Decision

Invites are created by trusted members or stewards, expire by default, are redeemable once, and store only hashed invite codes.

## Consequences

- Invite abuse can be traced to inviter accounts.
- Invite redemption must handle expired, revoked, and already-used codes.
- Invite emails should avoid exposing unnecessary private community data.
