# Database Schema

## Status

M1 foundation exists in `supabase/migrations/0001_foundation.sql`. M2 invite-only onboarding foundation is represented by the additive migration in `supabase/migrations/0002_m2_invite_onboarding_foundation.sql`. MVP introduction creation adds `supabase/migrations/0006_introduction_creation_workflow.sql` for durable introduction drafts from steward-approved persisted match suggestions. Helper capability, match recalculation, steward review, follow-up, and outcome semantics continue to be documented/tested at the MVP helper-contract layer pending production hardening.

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

## MVP Matching Entity

### job_seeker_requests

Represents a trusted member's job-help request for matching.

- id
- identity_id
- status
- headline
- target_role
- target_companies
- target_locations
- remote_preference
- salary_expectation
- work_authorization
- notes
- resume_url
- opened_at
- closed_at
- created_at
- updated_at

### introductions

Represents the MVP introduction draft a steward creates after approving a persisted match suggestion.

- id
- request_id
- match_suggestion_id
- requester_identity_id
- helper_identity_id
- steward_identity_id
- steward_review_id
- status
- message
- created_at
- updated_at

## Production Hardening Schema Remaining

Before production launch, additional durable tables or columns should be added for the workflow concepts still represented by helper contracts and tests:

- Helper capabilities, including categories, availability, capacity, helper preferences, and private notes.
- Match proposals or match runs, including score, explanation, recalculation metadata, and status.
- Steward reviews, including assignment, decision, decision reason, and audit linkage.
- Follow-ups or reminders, including due dates, completion, and notification state.
- Outcomes, including final result, timestamps, reporting-safe metadata, and privacy-preserving aggregation fields.

These schema additions are production hardening work and should be introduced with RLS policies, authorization tests, migration runbooks, and data-retention/privacy review.
