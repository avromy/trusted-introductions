# Database Schema

## Status

M1 foundation exists in `supabase/migrations/0001_foundation.sql`. M2 invite-only onboarding foundation is represented by the additive migration in `supabase/migrations/0002_m2_invite_onboarding_foundation.sql`. The completed M2 helper/action layer uses this schema shape for persisted invite, identity, profile, privacy, onboarding, and audit workflows; no additional schema change is required for the documentation sync.

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

## MVP Matching, Introduction, and Outcome Entities

The additive MVP migration in `supabase/migrations/0003_mvp_matching_intro_outcome_schema.sql` adds matching and introduction workflow persistence without altering or removing existing M2 tables.

### job_seeker_requests

Captures seeker intake for a requested role, target companies or locations, privacy-sensitive notes, and lifecycle timestamps.

- id
- identity_id
- community_id
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
- metadata
- opened_at
- closed_at
- created_at
- updated_at

### helper_capabilities

Captures helper intake, availability, capacity, expertise categories, and private steward/helper notes.

- id
- identity_id
- community_id
- categories
- availability_status
- weekly_intro_capacity
- next_available_at
- industries
- geographies
- languages
- private_notes
- metadata
- created_at
- updated_at

### match_suggestions

Represents a proposed helper match for a job seeker request, including rationale, optional scoring, review status, expiration, and conversion to an introduction.

- id
- job_seeker_request_id
- helper_capability_id
- helper_identity_id
- suggested_by_identity_id
- community_id
- status
- score
- rationale
- metadata
- expires_at
- converted_introduction_id
- created_at
- updated_at

### steward_match_reviews

Tracks steward review decisions for match suggestions before an introduction is sent.

- id
- match_suggestion_id
- steward_identity_id
- subject_identity_id
- status
- decision_reason
- decided_at
- due_at
- metadata
- created_at
- updated_at

### introductions

Tracks the actual introduction workflow from consent and send through response, completion, decline, or cancellation.

- id
- match_suggestion_id
- job_seeker_request_id
- helper_identity_id
- seeker_identity_id
- introduced_by_identity_id
- community_id
- status
- subject
- message
- consent_requested_at
- consented_at
- sent_at
- responded_at
- completed_at
- canceled_at
- metadata
- created_at
- updated_at

### introduction_follow_ups

Schedules and records follow-up nudges for introductions.

- id
- introduction_id
- assigned_to_identity_id
- status
- sequence_number
- due_at
- sent_at
- skipped_reason
- notes
- metadata
- created_at
- updated_at

### introduction_outcomes

Records qualitative and lightweight quantitative outcomes after introductions.

- id
- introduction_id
- reported_by_identity_id
- status
- met_at
- outcome_summary
- next_steps
- success_score
- metadata
- created_at
- updated_at

## Constraints and Indexes

- `trusted_identities.primary_email` is unique and normalized to lowercase.
- `communities.slug` is unique and URL-safe.
- `invitations.token_hash` is unique; plaintext invite tokens are not stored.
- Foreign keys connect roles, invitations, affiliations, privacy settings, audit events, seeker requests, helper capabilities, match suggestions, steward reviews, introductions, follow-ups, and outcomes to trusted identities and communities.
- Matching indexes support seeker request lookup, helper availability lookup, match review queues, introduction participant queues, due follow-ups, and outcome reporting.
- Row level security is enabled on M2 and MVP matching domain tables. Complex access policies are intentionally deferred; until policies are added, server-side service-role access is required for these protected tables.

## Deferred / MVP Remaining Schema

Public page, notification delivery, reporting rollups, and richer matching model tables remain deferred. Future migrations should stay additive and continue referencing the M2 identity, role, privacy, audit, and MVP matching workflow tables.
