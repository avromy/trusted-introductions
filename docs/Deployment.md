# Deployment

This runbook documents the production deployment expectations for Trusted Introductions. The application handles sensitive identity, resume, contact, match, introduction, follow-up, and outcome data, so every production release must be explicit, reversible, and verified.

## Deployment Status

The MVP core paths are implemented, but broad rollout remains blocked on production hardening. Treat production deployments as steward-approved releases until observability, backup drills, and operational reporting are complete.

## Production Environment Checklist

Configure secrets in the production hosting provider and Supabase project secret manager. Do not commit production values to source control.

| Variable | Required | Production expectation |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | Canonical HTTPS production origin, with no trailing slash. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Production Supabase project API URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Production Supabase anon key for browser/server client creation. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Production service-role key, available only to trusted server-side runtime contexts and CI/CD migration jobs. |
| `SUPABASE_STORAGE_RESUME_BUCKET` | Yes | Private resume bucket name; expected default is `private-resumes` unless the migration and configuration are intentionally changed together. |

Before promoting a release, confirm that:

- Production and staging use separate Supabase projects, storage buckets, auth settings, and secrets.
- The production `NEXT_PUBLIC_APP_URL` matches configured Supabase auth redirect URLs.
- Service-role access is unavailable to client-side bundles and browser-exposed configuration.
- Secret rotation owners are assigned for Supabase anon and service-role keys.
- `.env.example` remains aligned with newly required variables.

## Required npm Checks

Run these scripts exactly as defined in `package.json` before deployment:

```bash
npm run typecheck
npm run test -- --run
npm run build
```

Additional checks are encouraged when time permits:

```bash
npm run lint
npm run format:check
```

Do not deploy if typecheck, tests, or build fail.

## Supabase Migration Process

Supabase migrations live in `supabase/migrations` and must be applied in filename order. Production migrations should be additive whenever possible and reviewed for privacy, RLS, and rollback impact before release.

### Local validation

1. Start the local Supabase stack.
2. Reset the local database from migrations:

   ```bash
   supabase start
   supabase db reset
   ```

3. Run the required npm checks after the reset:

   ```bash
   npm run typecheck
   npm run test -- --run
   npm run build
   ```

### Staging migration rehearsal

1. Back up the staging database before applying migrations.
2. Link the Supabase CLI to the staging project.
3. Apply pending migrations with the Supabase CLI for the linked project.
4. Verify RLS-sensitive workflows for invites, onboarding, seeker requests, helper capabilities, matching, steward review, introductions, follow-ups, outcomes, and private resume storage.
5. Record the migration files applied, reviewer, timestamp, and verification notes in the release record.

### Production migration release

1. Announce the migration window and expected user impact.
2. Confirm a fresh production backup is available before applying migrations.
3. Apply the same migration set that passed staging.
4. Watch Supabase database, auth, storage, and API health during and after migration.
5. Stop the release and begin rollback planning if any migration fails, partially applies, or changes data in an unexpected way.

## Preflight Checks

Complete this checklist before every production deployment:

- Release branch is up to date with `main` and has an approved pull request.
- `npm run typecheck`, `npm run test -- --run`, and `npm run build` pass locally or in CI.
- Deployment diff contains no unintended application route UX changes.
- Database migrations have been validated locally and rehearsed in staging when present.
- Environment variables are present in the production host and match this runbook.
- Supabase auth redirect URLs include the production `NEXT_PUBLIC_APP_URL`.
- Private storage bucket access is verified for resumes.
- Current production backup status is known, including restore point and retention window.
- Rollback owner, communications owner, and verification owner are assigned.
- Steward-facing workflows have a manual support path if notifications or background operations are degraded.

## Backup and Restore Expectations

Production must use managed Supabase backups with a documented retention period appropriate for sensitive community data. Before each release that includes migrations or data-shape changes:

- Confirm the latest automated backup completed successfully.
- Create or identify a restore point immediately before applying migrations.
- Document the expected restore time objective and who can initiate a restore.
- Treat private resume storage as production data: verify the bucket is private, access policies remain restrictive, and any storage backup/export process is covered by the same privacy expectations as the database.
- Practice restore drills in staging before relying on production restore procedures.

Restore decisions must account for user trust. If restoring would lose accepted introductions, follow-ups, outcomes, profile changes, or privacy changes, coordinate steward communications before proceeding.

## Rollback Guidance

Prefer roll-forward fixes for small, low-risk defects that do not expose private data or block core workflows. Roll back immediately when a release causes privacy exposure, authentication failure, data corruption, broken onboarding, broken invite redemption, inaccessible resumes, or failed introduction/outcome workflows.

### Application rollback

1. Pause additional deployments.
2. Re-deploy the last known-good application version from the hosting provider.
3. Confirm environment variables were not changed unexpectedly.
4. Run post-deploy verification against the restored version.
5. Document the incident, user impact, and follow-up tasks.

### Database rollback

Database rollback is higher risk than application rollback. Do not manually reverse production data changes without a reviewed plan.

1. Identify whether the failure is schema-only, data-related, RLS-related, or storage-related.
2. If safe, apply a reviewed forward migration that restores compatibility.
3. If restore is required, use the pre-release backup/restore point and communicate expected data loss or downtime.
4. After restore, rerun post-deploy verification and reconcile any steward-visible work created between backup time and restore time.

## Post-deploy Verification

After application deployment and any migrations are complete, verify the production environment from a clean browser session and an operator console:

- Public app loads at `NEXT_PUBLIC_APP_URL` over HTTPS.
- Supabase auth can create or resume a session using approved production auth settings.
- Invite validation rejects invalid, expired, revoked, blocked, and redeemed invite states safely.
- Invite-only onboarding can proceed through trusted identity, role/contribution mode, profile, privacy settings, and completion checks.
- Job seeker requests and helper capabilities persist and respect privacy expectations.
- Matching and steward review flows can read required data without leaking private details.
- Introduction, follow-up, and outcome records can be created and reviewed by authorized users.
- Private resume storage remains private and accessible only through authorized server-side paths.
- Error logs, deployment logs, and Supabase health indicators show no new production errors.

Record verification results in the release notes or pull request, including the exact commit, migration set, verifier, date, and any follow-up issues.
