# Database Schema

## Status

M1 foundation exists in `supabase/migrations/0001_foundation.sql`. M2 invite-only onboarding foundation is represented by the additive migration in `supabase/migrations/0002_m2_invite_onboarding_foundation.sql`. The current M2 helper/action layer uses this schema shape; no additional schema change is required for the documentation sync.

## M2 Invite-Only Onboarding Entities

### trusted_identities

Represents one trusted identity per person and optionally links to a Supabase auth user.

- id
- user_id
- primary_email
- display_name
- legal_name
- phone
- status
- metadata
- created_at
- updated_at

### communities

Represents invite-only communities that can grant roles, affiliations, and invitations.

- id
- slug
- name
- description
- created_by_identity_id
- created_at
- updated_at

### user_roles

Represents role assignments for trusted identities, optionally scoped to a community.

- id
- identity_id
- community_id
- role
- granted_by_identity_id
- created_at
- updated_at

### invitations

Tracks invite creation and redemption. Invite tokens are stored as hashes only, matching the M2 invite lifecycle helpers that generate plaintext tokens only for delivery and persist hashed token payloads.

- id
- community_id
- inviter_identity_id
- invitee_email
- token_hash
- status
- redemption_status
- redeemed_by_identity_id
- expires_at
- redeemed_at
- created_at
- updated_at

### affiliations

Represents an identity's affiliation with a community.

- id
- identity_id
- community_id
- affiliation_type
- title
- organization
- starts_at
- ends_at
- created_at
- updated_at

### privacy_settings

Stores explicit privacy choices for an identity. The M2 privacy helper defaults remain restrictive and should be persisted here before matching, helper activity disclosure, AI summaries, or public sharing depend on the settings.

- id
- identity_id
- profile_visibility
- contact_visibility
- resume_visibility
- allow_ai_summary
- public_meet_page_enabled
- created_at
- updated_at

### audit_events

Append-only record for sensitive onboarding actions.

- id
- actor_identity_id
- community_id
- event_type
- subject_table
- subject_id
- metadata
- created_at

## Constraints and Indexes

- `trusted_identities.primary_email` is unique and normalized to lowercase.
- `communities.slug` is unique and URL-safe.
- `invitations.token_hash` is unique; plaintext invite tokens are not stored.
- Foreign keys connect roles, invitations, affiliations, privacy settings, and audit events to trusted identities and communities.
- Indexes support invite token lookup, identity lookup, community lookup, and audit lookup.
- Row level security is enabled on M2 domain tables. Complex access policies are intentionally deferred.

## Deferred

The M2 migration does not add matching, introduction workflow, public page, or application business-logic tables. Remaining M2 server work should connect invite, onboarding, identity/profile, privacy, and audit helpers to these existing tables before introducing M3 matching tables.
