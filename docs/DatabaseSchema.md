# Database Schema

## Status

The MVP persistence layer is implemented through additive Supabase migrations: `0001_foundation.sql`, `0002_m2_invite_onboarding_foundation.sql`, `0003_job_seeker_request_persistence.sql`, `0004_helper_capability_persistence.sql`, `0005_match_suggestion_persistence.sql`, and `0006_introduction_creation.sql`. Current schema and TypeScript database types cover persisted onboarding, seeker requests, helper capabilities, match suggestions, steward reviews, and introductions. Follow-up reminder and outcome semantics are covered at the helper/action/test layer pending durable production hardening tables.

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

## MVP Matching and Introduction Entities

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

### helper_capabilities

Represents a trusted member's availability and categories for helping seekers.

- id
- identity_id
- categories
- availability_status
- weekly_intro_capacity
- next_available_at
- industries
- geographies
- languages
- private_notes
- created_at
- updated_at

### match_suggestions

Stores ranked, explainable helper suggestions for a seeker request.

- id
- request_id
- helper_identity_id
- helper_capability_id
- rank
- score
- reasons
- metadata
- created_at
- updated_at

### steward_reviews

Durably records steward review assignments and decisions for proposed helper matches. Decision reasons are private application data and audit events store only safe metadata.

- id
- request_id
- steward_identity_id
- subject_identity_id
- match_suggestion_id
- status
- decision_reason
- decided_at
- created_at
- updated_at

### introductions

Represents a steward-created introduction workflow from an approved match suggestion.

- id
- request_id
- match_id
- steward_review_id
- requester_identity_id
- helper_identity_id
- created_by_identity_id
- status
- context
- created_at
- updated_at

## Production Hardening Schema Remaining

The MVP core is complete with persisted onboarding, matching, review, and introduction entities. Before production launch, durable tables or columns should be added for workflow concepts still represented by helper contracts and tests:

- Follow-ups or reminders, including due dates, completion, notification state, retry metadata, and unsubscribe/compliance state.
- Outcomes, including final result, timestamps, reporting-safe metadata, and privacy-preserving aggregation fields.
- Optional match-run metadata if stewards need historical recalculation grouping beyond persisted match suggestions.
- Additional audit/observability tables if operational review cannot be satisfied by `audit_events` and logs.

These schema additions are production hardening work and should be introduced with RLS policies, authorization tests, migration runbooks, and data-retention/privacy review.
