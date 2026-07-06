# API

## Status

Proposed. No application API exists yet.

## Principles

- Server-side authorization and privacy enforcement are mandatory.
- APIs should model community help, not recruiting transactions.
- Match explanations are first-class API fields.
- Mutating sensitive resources should emit audit events.

## Proposed Endpoints

### Invitations

- `POST /api/invites` — create an invite.
- `GET /api/invites/:code` — validate invite metadata without revealing sensitive inviter data.
- `POST /api/invites/:code/redeem` — redeem invite and create trusted identity.

### Identity and Profiles

- `GET /api/me` — current identity and permissions.
- `PATCH /api/me/profile` — update profile.
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
