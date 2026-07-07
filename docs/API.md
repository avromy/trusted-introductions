# API

## Status

No public HTTP application API is exposed yet. M2 now has a server-consumable helper/action foundation for invites, onboarding state, privacy checks, auth session identity, and audit event payloads. The next M2 API/server-action work should wrap these helpers with persistence, authorization, and audit writes rather than duplicating lifecycle logic in route handlers.

## Principles

- Server-side authorization and privacy enforcement are mandatory.
- APIs should model community help, not recruiting transactions.
- Match explanations are first-class API fields.
- Mutating sensitive resources should emit audit events.
- Invite validation responses must be safe: do not return plaintext tokens, inviter identity details, or hidden community/member data.
- Identity, profile, and privacy mutations should flow through server helpers/actions so client components do not enforce trust decisions by themselves.

## Implemented Helper Layer

### Invitations

The invite helper layer supports:

- Creating insert payloads with normalized invitee email, inviter identity, optional community, expiration, pending status, not-redeemed status, and a hashed token.
- Returning the plaintext token only at creation time for delivery workflows.
- Validating redemption eligibility for pending, unexpired, unrevoked, unblocked, unused invites.
- Detecting invalid lifecycle states: expired, revoked, redeemed, blocked, and token mismatch.
- Returning safe validation metadata limited to invite id, invitee email, community id, and expiration.
- Producing payloads for redeemed and revoked invite state transitions.

### Onboarding State

The onboarding helper layer calculates the current onboarding step and next route from:

- Invite validity.
- Trusted identity presence and active status.
- Role or contribution mode selection.
- Profile completeness.
- Privacy settings completeness.

### Identity, Profile, and Privacy Direction

M2 identity/profile/privacy APIs should be server-first:

- Identity helpers should resolve the current signed-in auth identity and then load or create the trusted identity record during invite redemption.
- Profile helpers should validate minimal member context and contribution-mode data before marking profile setup complete.
- Privacy helpers should apply restrictive defaults and decide whether profile, resume, contact, helper activity, AI summary, or public meet page data may be exposed.
- Future route handlers/server actions should compose these helpers with Supabase persistence and audit writes.

## Planned Endpoints / Server Actions

These remain planned integration points; exact route shape may be implemented as Next.js server actions or HTTP route handlers.

### Invitations

- `POST /api/invites` — create an invite for an authorized trusted member or steward.
- `GET /api/invites/:code` — validate invite metadata without revealing sensitive inviter data.
- `POST /api/invites/:code/redeem` — redeem invite, create or attach trusted identity, and mark invite accepted/redeemed once.
- `POST /api/invites/:id/revoke` — revoke or block an outstanding invite with an audit event.

### Identity and Profiles

- `GET /api/me` — current auth identity, trusted identity, roles, onboarding state, and permissions.
- `PATCH /api/me/role` — update role or contribution mode during onboarding.
- `PATCH /api/me/profile` — update initial profile/member context.
- `PATCH /api/me/privacy` — update privacy settings.

### Job Seeker Requests

- `POST /api/seeker-requests` — create help request.
- `GET /api/seeker-requests/:id` — view request subject to permissions.
- `PATCH /api/seeker-requests/:id` — update request.

### Helper Capabilities

- `GET /api/helper-capabilities/me` — view own helper settings.
- `PATCH /api/helper-capabilities/me` — update helper capabilities and capacity.

### Matching

- `POST /api/matches/recalculate` — steward-only recalculation trigger.
- `GET /api/seeker-requests/:id/matches` — steward or permitted seeker match list.
- `PATCH /api/matches/:id/status` — review, accept, defer, or reject match.

### Introductions and Outcomes

- `POST /api/introductions` — create introduction workflow from accepted match.
- `PATCH /api/introductions/:id` — update status.
- `POST /api/introductions/:id/outcomes` — record outcome.

## Error Model

Use consistent error responses:

- `code`
- `message`
- `request_id`
- optional `details`

Privacy denials should not reveal whether hidden resources exist.
