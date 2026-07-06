# Database Schema

## Status

Proposed. No migrations exist yet.

## Entity Overview

### people

Represents one trusted identity per person.

- id
- primary_email
- display_name
- legal_name_optional
- phone_optional
- community_affiliation_optional
- identity_status
- created_at
- updated_at

### invites

Tracks invite creation and redemption.

- id
- inviter_person_id
- invitee_email
- invite_code_hash
- status
- expires_at
- redeemed_by_person_id
- created_at
- redeemed_at

### profiles

Stores user-facing profile details.

- id
- person_id
- headline
- bio
- location
- linkedin_url
- visibility
- created_at
- updated_at

### privacy_settings

Stores explicit privacy choices.

- id
- person_id
- resume_visibility
- profile_visibility
- contact_visibility
- public_meet_page_enabled
- allow_ai_summary
- updated_at

### job_seeker_requests

Represents a help request, not a job application.

- id
- person_id
- target_roles
- target_industries
- target_locations
- help_needed
- urgency
- status
- created_at
- updated_at

### helper_capabilities

Represents ways a helper can contribute.

- id
- person_id
- industries
- companies
- functions
- contribution_modes
- capacity_status
- notes
- updated_at

### matches

Stores explainable recommendations.

- id
- seeker_request_id
- helper_person_id
- score
- explanation
- status
- reviewed_by_person_id
- created_at
- updated_at

### introductions

Tracks human bridge workflows.

- id
- match_id
- seeker_person_id
- helper_person_id
- status
- helper_message_optional
- steward_notes
- created_at
- completed_at

### outcomes

Tracks results of help.

- id
- introduction_id
- outcome_type
- outcome_notes
- follow_up_date
- recorded_by_person_id
- created_at

### audit_events

Append-only record for sensitive actions.

- id
- actor_person_id
- event_type
- subject_type
- subject_id
- metadata_json
- created_at

## Required Constraints

- `people.primary_email` must be unique.
- Invite codes must be stored hashed, never plaintext.
- Privacy settings must be checked before exposing profile, contact, resume, or public page data.
- Sensitive state transitions should emit audit events.
