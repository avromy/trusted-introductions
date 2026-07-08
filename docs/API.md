# API

## Status

No public HTTP application API is exposed yet. M2 now has server-consumable actions and repositories for the MVP onboarding path: invite creation, safe invite validation, invite redemption, invite revocation, trusted identity onboarding, profile setup, privacy settings, onboarding state loading, auth session identity, and audit event writes. The next public API/server-action expansion should focus on M3 matching and M4 introduction/outcome workflows while reusing the completed M2 onboarding actions instead of duplicating lifecycle logic in route handlers.

## Principles

- Server-side authorization and privacy enforcement are mandatory.
- APIs should model community help, not recruiting transactions.
- Match explanations are first-class API fields.
- Mutating sensitive resources should emit audit events.
- Invite validation responses must be safe: do not return plaintext tokens, inviter identity details, or hidden community/member data.
- Identity, profile, and privacy mutations should flow through server helpers/actions so client components do not enforce trust decisions by themselves.

## Implemented Helper/Action Layer

### Invitations

The invite helper/action layer supports:

- Creating insert payloads with normalized invitee email, inviter identity, optional community, expiration, pending status, not-redeemed status, and a hashed token.
- Returning the plaintext token only at creation time for delivery workflows.
- Validating redemption eligibility for pending, unexpired, unrevoked, unblocked, unused invites.
- Detecting invalid lifecycle states: expired, revoked, redeemed, blocked, and token mismatch.
- Returning safe validation metadata limited to invite id, invitee email, community id, and expiration.
- Producing payloads for redeemed and revoked invite state transitions.
- Persisting invite creation, redemption, and revocation through server actions and repository helpers.
- Writing audit events for invite creation, acceptance/redemption, and revocation.

### Onboarding State

The onboarding helper layer calculates the current onboarding step and next route from:

- Invite validity.
- Trusted identity presence and active status.
- Role or contribution mode selection.
- Profile completeness.
- Privacy settings completeness.

### Identity, Profile, and Privacy

The M2 identity/profile/privacy action layer is server-first:

- Identity actions resolve the current signed-in auth identity and load or create the trusted identity record during invite redemption.
- Profile actions validate contribution mode and minimal member context before persisting setup data.
- Privacy actions apply restrictive defaults and persist whether profile, resume, contact, helper activity, AI summary, or public meet page data may be exposed.
- Onboarding server loading composes auth, trusted identity, role/profile, privacy, invite, and completion state for server-rendered onboarding pages.

## Implemented Server Actions and Planned Endpoints

The M2 onboarding integration points are implemented as Next.js server actions and repository helpers rather than public HTTP endpoints. Future M3/M4 route shape may use server actions or HTTP route handlers.

### Invitations

Implemented as server actions/repositories:

- Create an invite for an authorized trusted member or steward.
- Validate invite metadata without revealing sensitive inviter data.
- Redeem invite, create or attach trusted identity, and mark invite accepted/redeemed once.
- Revoke an outstanding invite with an audit event.

Potential future HTTP equivalents may be added only if external clients need them.

### Identity and Profiles

Implemented as server actions/server loaders:

- Current auth identity, trusted identity, roles, onboarding state, and permissions.
- Role or contribution-mode update during onboarding.
- Initial profile/member context update.
- Privacy settings update.

### Job Seeker Requests

- `POST /api/seeker-requests` — create help request.
- `GET /api/seeker-requests/:id` — view request subject to permissions.
- `PATCH /api/seeker-requests/:id` — update request.

### Helper Capabilities

- `GET /api/helper-capabilities/me` — view own helper settings.
- `PATCH /api/helper-capabilities/me` — update helper capabilities and capacity.

### Matching

M3 matching remains planned; no matching API or server action is implemented yet. Expected integration points:

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
