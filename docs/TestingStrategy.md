# Testing Strategy

## Current Status

Only documentation presence CI exists. Application tests should be added with the app scaffold.

## Required Check Categories

- Formatting.
- Linting.
- Typechecking.
- Unit tests.
- Integration tests for API and database behavior.
- End-to-end tests for critical flows.
- Build verification.

## Critical Flows To Test

- Invite creation and redemption.
- Duplicate identity prevention.
- Privacy setting enforcement.
- Job seeker request creation.
- Helper capability updates.
- Match explanation generation.
- Introduction workflow transitions.
- Outcome recording.

## Security and Privacy Tests

- Hidden resources must not leak through API errors.
- Resume/contact visibility must follow privacy settings.
- Invite tokens must not be stored in plaintext.
- Public meet pages must be opt-in and revocable.
