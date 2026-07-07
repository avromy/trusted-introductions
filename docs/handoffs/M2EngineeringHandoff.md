# M2 Engineering Handoff — Invite-only Onboarding

## Date

2026-07-07

## Author / Session

Codex engineering handoff session.

## Scope

Concise implementation handoff for the next sprint. This does not redesign the roadmap or add application code.

## Current Repository State

- Branch: `work`.
- Latest completed sprint PR observed in git history: PR #10, `scaffold-application-foundation-for-next.js-eozu0l`.
- M1 foundation is present: Next.js app routes, reusable UI primitives, Supabase client/server helpers, environment validation, Vitest setup, CI workflow, and a foundation Supabase migration.
- M2 product decisions are documented but the M2 feature implementation has not started.

## Completed Pieces Relevant to M2

- Product scope confirms invite-only account creation, one trusted identity per person, profile contribution modes, and privacy preferences as MVP requirements.
- ADRs exist for the identity model, invite system, trust model, resume privacy, and feature flags.
- API documentation proposes invite validation/redemption plus current-user profile and privacy endpoints.
- Database documentation proposes the M2 domain entities: `people`, `invites`, `profiles`, and `privacy_settings`.
- App scaffolding includes placeholder routes for auth, dashboard, admin, helper, job seeker, and community surfaces.
- Supabase foundation exists only for platform setup: `pgcrypto` and a private resume storage bucket.
- Tests currently cover environment validation only.

## Remaining M2 Implementation Work

1. Add M2 database migrations for `people`, `invites`, `profiles`, `privacy_settings`, role/capability fields needed for stewards, RLS policies, and audit hooks for sensitive state changes.
2. Update generated or hand-maintained Supabase types after migrations are finalized.
3. Implement invite creation for authorized stewards or trusted inviters, including hashed invite codes, expiration, revocation/status handling, and audit events.
4. Implement invite validation and redemption that creates or links one trusted identity per person without exposing unnecessary inviter/community data.
5. Implement authenticated current-user/profile/privacy flows with server-side authorization and privacy enforcement.
6. Add onboarding UI that connects invite redemption, trusted identity creation, profile setup, and privacy settings without changing the M2 scope.
7. Expand tests for invite lifecycle, identity uniqueness, privacy defaults, RLS/authorization behavior, and basic onboarding UI states.
8. Update `docs/DatabaseSchema.md` from proposed to implemented details once migrations land.

## Known Risks

- The database schema document still says no migrations exist, while the repository now has a foundation migration; the next migration PR should reconcile implementation docs with actual schema state.
- Invite security depends on never persisting plaintext invite codes and on handling expired, revoked, and already-used codes consistently.
- Identity uniqueness can be undermined by email casing, aliases, or account recovery flows if normalization rules are not defined early.
- Privacy settings must be enforced server-side before profile, contact, resume, public page, or AI-related data is exposed.
- Steward/admin permissions are not implemented yet, so M2 invite creation needs a minimal authorization model before UI work depends on it.
- Current tests are too narrow to catch M2 authorization, RLS, or privacy regressions.

## Next Recommended PRs

1. **M2 schema and RLS PR**: add the domain migration for people, invites, profiles, privacy settings, minimal stewardship/authorization fields, audit events, and tests or SQL checks where practical.
2. **Invite lifecycle API PR**: implement create, validate, redeem, revoke/expire behavior with hashed codes and audit events.
3. **Onboarding profile/privacy PR**: implement current-user, profile setup, privacy settings, and the invite redemption UI path.
4. **M2 documentation sync PR**: update database/API docs and backlog after the implemented API and schema names are final.

## Commands Required Before Merge

```bash
npm run typecheck
npm run test -- --run
npm run build
```

## Recommended Next Step

Start with the M2 schema and RLS PR. Keep the first implementation PR narrow so later Codex or engineer sessions can build invite APIs and onboarding UI on stable tables, policies, and type definitions.
