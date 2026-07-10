# API

## Status

No public HTTP application API is exposed yet. The MVP core is implemented as server-consumable helpers, actions, repositories, and documented contracts rather than external route handlers. M2 onboarding, M3 matching, and the M4 introduction/follow-up/outcome loop are complete for MVP coverage; production hardening remains before exposing stable public HTTP APIs.

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

The MVP integration points are implemented as Next.js server actions and repository helpers rather than public HTTP endpoints. Future external API shape may use server actions or HTTP route handlers only when non-web clients or stable public integration points are needed.

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

Implemented for MVP as helpers/repositories/actions rather than public HTTP endpoints:

- Normalize and validate seeker request intake.
- Persist seeker request rows through repository helpers.
- Serialize safe public/helper views without leaking private steward notes, salary, work authorization, or resume URL fields to unauthorized contexts.

Potential future HTTP equivalents, after hardening:

- `POST /api/seeker-requests` — create help request.
- `GET /api/seeker-requests/:id` — view request subject to permissions.
- `PATCH /api/seeker-requests/:id` — update request.

### Helper Capabilities

Implemented for MVP as helper models and safe serializers:

- Normalize supported helper categories, labels, availability, and weekly introduction capacity.
- Strip private helper notes from serialized helper capability views.
- Check whether a helper is available for introductions.

Potential future HTTP equivalents, after hardening:

- `GET /api/helper-capabilities/me` — view own helper settings.
- `PATCH /api/helper-capabilities/me` — update helper capabilities and capacity.

### Matching

M3 matching is complete for MVP helper coverage:

- Recalculate ranked helper candidates from deterministic matching signals.
- Return human-readable explanations with each score.
- Respect helper opt-out and unavailable states.
- Apply steward review decision helpers for approval, rejection, needs-info transitions, final-status protection, and assigned-steward enforcement.

Potential future HTTP equivalents, after hardening:

- `POST /api/matches/recalculate` — steward-only recalculation trigger.
- `GET /api/seeker-requests/:id/matches` — steward or permitted seeker match list.
- `PATCH /api/matches/:id/status` — review, accept, defer, or reject match.

### Introductions, Follow-ups, and Outcomes

M4 is complete for MVP reconciliation. Introduction creation is implemented through server actions/repositories with persisted introduction rows. Follow-up reminders and outcomes are covered by helper/action layers and tests; durable reminder/outcome tables, notification scheduling, and public route handlers remain hardening work.

Potential future HTTP equivalents, after hardening:

- `POST /api/introductions` — create introduction workflow from accepted match.
- `PATCH /api/introductions/:id` — update status.
- `POST /api/introductions/:id/follow-ups` — schedule or complete a follow-up.
- `POST /api/introductions/:id/outcomes` — record outcome.

## Error Model

Use consistent error responses:

- `code`
- `message`
- `request_id`
- optional `details`

Privacy denials should not reveal whether hidden resources exist.
