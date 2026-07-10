# Production RLS/Auth Policy Audit

## Status

This audit inventories the tables declared in the existing Supabase migrations and compares current row level security (RLS) coverage with production authorization requirements. It is documentation-only and does not change migrations or policies.

## Role model used for this audit

- **anon**: unauthenticated Supabase client. Should not directly read or mutate application tables.
- **authenticated self**: signed-in user whose `auth.uid()` is linked to `trusted_identities.user_id`.
- **member**: trusted identity with a `user_roles.role = 'member'` assignment, scoped globally or to the relevant community.
- **steward**: trusted identity with `user_roles.role = 'steward'`, scoped globally or to the relevant community.
- **admin**: trusted identity with `user_roles.role = 'admin'`, scoped globally or to the relevant community.
- **service_role / trusted server code**: backend-only Supabase service role used by server actions, operational jobs, matching, and audit logging. It bypasses RLS and must not be exposed to browsers.

## Current policy inventory

| Object | Migration | Current RLS state | Current policies found | Production gap |
| --- | --- | --- | --- | --- |
| `storage.buckets` row for `private-resumes` | `0001_foundation.sql` | Uses Supabase Storage defaults; no storage object policies in repo | None in migrations | Add `storage.objects` policies for private resume upload/read/delete by owner and steward/admin review paths. |
| `trusted_identities` | `0002_m2_invite_onboarding_foundation.sql` | RLS enabled | None | Default-deny for normal clients; add explicit self/steward/admin policies. |
| `communities` | `0002_m2_invite_onboarding_foundation.sql` | RLS enabled | None | Default-deny for normal clients; add member/steward/admin read and admin write policies. |
| `user_roles` | `0002_m2_invite_onboarding_foundation.sql` | RLS enabled | None | Default-deny for normal clients; add self role read, steward scoped read, admin grant/revoke policies. |
| `invitations` | `0002_m2_invite_onboarding_foundation.sql` | RLS enabled | None | Default-deny for normal clients; invite validation/redemption must use server code or narrowly scoped policies. |
| `affiliations` | `0002_m2_invite_onboarding_foundation.sql` | RLS enabled | None | Default-deny for normal clients; add self/steward/admin policies with privacy-aware reads. |
| `privacy_settings` | `0002_m2_invite_onboarding_foundation.sql` | RLS enabled | None | Default-deny for normal clients; add owner read/update and steward/admin limited read policies. |
| `audit_events` | `0002_m2_invite_onboarding_foundation.sql` | RLS enabled | None | Default-deny for normal clients; require append-only service writes and admin/steward operational reads. |
| `job_seeker_requests` | `0003_job_seeker_request_persistence.sql` | RLS enabled | None | Default-deny for normal clients; add owner, steward, admin, and matching-service access policies. |
| `helper_capabilities` | `0004_helper_capability_persistence.sql` | RLS not enabled in migration | None | Critical gap: table is directly accessible according to grants unless locked elsewhere; enable RLS and add owner/steward/admin policies. |
| `match_suggestions` | `0005_match_suggestion_persistence.sql` | RLS not enabled in migration | None | Critical gap: matching data may be directly accessible according to grants unless locked elsewhere; enable RLS and add participant/steward/admin policies. |
| `steward_reviews` | `0006_introduction_creation.sql` | RLS enabled | None | Default-deny for normal clients; add assigned steward/admin read-write and subject/requester limited read policies. |
| `introductions` | `0006_introduction_creation.sql` | RLS enabled | None | Default-deny for normal clients; add participant/steward/admin policies and status transition controls. |

## Table-by-table production requirements

### `trusted_identities`

Contains personal identity data, including email, names, phone, status, and metadata.

| Operation | Expected production access |
| --- | --- |
| Read | `authenticated self` can read their own identity. `steward` can read identities in communities they steward when needed for matching, review, or introductions. `admin` can read scoped identities. `anon` has no direct access. |
| Insert | `service_role / trusted server code` creates identities during invite redemption/onboarding. Self-service insert is acceptable only through a server action that verifies the signed-in user and normalized email. |
| Update | `authenticated self` can update safe profile fields only through validated server code or column-scoped policies. `steward` may update operational status only if explicitly delegated. `admin` can update status and administrative metadata. |
| Delete | Hard delete should be restricted to `admin` or retention/privacy jobs using `service_role`; prefer archive/suspend over delete. |
| Gap | RLS is enabled but there are no policies, so browser clients are blocked today. Production needs explicit owner and operational policies plus column/field controls in server code. |

### `communities`

Contains community names, slugs, descriptions, and creator identity references.

| Operation | Expected production access |
| --- | --- |
| Read | `member`, `steward`, and `admin` can read communities they belong to; public discovery should use a separate reviewed view if needed. |
| Insert | `admin` or `service_role` only. |
| Update | `admin` for scoped community metadata. |
| Delete | `admin` or `service_role` only; production should prefer disabling/archiving if references exist. |
| Gap | RLS is enabled but there are no policies. Add scoped membership reads and admin-only mutations. |

### `user_roles`

Stores application authorization assignments and is security-critical.

| Operation | Expected production access |
| --- | --- |
| Read | Users can read their own effective roles. `steward` can read roles in stewarded communities if needed for operations. `admin` can read scoped roles. |
| Insert | `admin` or `service_role` only after authorization and audit logging. |
| Update | `admin` or `service_role` only; role changes should be audited. |
| Delete | `admin` or `service_role` only for revocation; role removals should be audited. |
| Gap | RLS is enabled but no policies exist. Production must avoid any member-managed role writes and add audit-backed admin policies. |

### `invitations`

Stores invitee emails, token hashes, invite status, redemption status, and redemption timestamps.

| Operation | Expected production access |
| --- | --- |
| Read | `steward`/`admin` can list invitations for scoped communities. Invited users should validate tokens only through server actions using token hashes, not broad table reads. Inviters may see invitations they created if product requirements allow. |
| Insert | `steward`/`admin` through server code that hashes tokens and audits creation. |
| Update | `service_role` or authorized server actions for redemption, revocation, expiration, and block state transitions. `steward`/`admin` may revoke scoped invitations. |
| Delete | Prefer status transitions over delete. Physical delete only by `admin`/retention job. |
| Gap | RLS is enabled but no policies exist. Production needs invite-specific policies or all invite workflows must remain server-only. |

### `affiliations`

Connects identities to communities and stores affiliation descriptors.

| Operation | Expected production access |
| --- | --- |
| Read | Owner can read their own affiliations. Community `member`/`steward`/`admin` reads should respect profile visibility and community scope. |
| Insert | Self-service affiliation claims may be allowed only through validation; otherwise `steward`/`admin` or `service_role`. |
| Update | Owner can update self-asserted non-sensitive fields when allowed; `steward`/`admin` can verify or correct scoped affiliations. |
| Delete | Owner can remove self-asserted affiliations if no audit/role dependency; `admin`/`service_role` can remove scoped affiliations. |
| Gap | RLS is enabled but no policies exist. Add privacy-aware self/community/steward/admin rules. |

### `privacy_settings`

Stores visibility preferences for profile, contact, resume, AI summary, public meet pages, and helper activity.

| Operation | Expected production access |
| --- | --- |
| Read | Owner can read all settings. `steward`/`admin` may read settings needed to enforce privacy, but should not expose private contact or resume data by default. |
| Insert | Owner during onboarding via server code; `service_role` may create defaults. |
| Update | Owner can update their settings. `admin` changes should be exceptional, audited, and generally limited to disabling risky public exposure. |
| Delete | `service_role` or retention/privacy workflows only; prefer recreating restrictive defaults. |
| Gap | RLS is enabled but no policies exist. Add owner read/write and carefully scoped operational read policies. |

### `audit_events`

Append-only operational audit log for sensitive actions.

| Operation | Expected production access |
| --- | --- |
| Read | `admin` can read scoped audit events. `steward` can read limited community events needed for operations. Regular members should not directly read raw audit logs. |
| Insert | `service_role / trusted server code` only. Client inserts should not be trusted. |
| Update | No production update access. Audit rows are immutable. |
| Delete | No routine delete access; retention jobs using `service_role` may purge according to policy. |
| Gap | RLS is enabled but no policies exist. Add service-only insert and scoped operational read policies; keep update/delete denied. |

### `job_seeker_requests`

Stores job seeker request details, target companies/locations, compensation notes, authorization notes, and resume URL.

| Operation | Expected production access |
| --- | --- |
| Read | Owner can read their requests. `steward` can read requests in their community for review/matching. Matched helpers may read only the subset needed after approval/introduction. `admin` can read scoped requests. |
| Insert | Owner through validated server action, or `service_role` on behalf of owner. |
| Update | Owner can update drafts/open requests and close/withdraw their own requests. `steward`/`admin` may update operational status only through audited workflow actions. |
| Delete | Owner may withdraw/close; physical delete should be `admin`/retention job only. |
| Gap | RLS is enabled but no policies exist. Add owner/steward/admin policies and avoid exposing resume/contact fields in broad reads. |

### `helper_capabilities`

Stores helper availability, categories, capacity, preferences, and private notes.

| Operation | Expected production access |
| --- | --- |
| Read | Owner can read their full capability record. `steward`/matching service can read capabilities for matching. Other members may see only approved public helper signals, not private notes. `admin` can read scoped records. |
| Insert | Owner through validated server action, or `service_role`. |
| Update | Owner can update their own availability/capacity/preferences. `steward`/`admin` may update operational fields only if product requirements allow and actions are audited. |
| Delete | Owner can disable or delete their helper profile if no dependent workflow requires retention; `admin`/retention job can physically delete. |
| Gap | RLS is not enabled in the migration and no policies exist. This is a critical production gap. Enable RLS, create owner/steward/admin policies, and protect `private_notes`. |

### `match_suggestions`

Stores generated request-helper suggestions, scores, explanations, and metadata.

| Operation | Expected production access |
| --- | --- |
| Read | `steward` can read suggestions for assigned/scoped requests. Request owner may read approved or surfaced suggestions only after review. Helper may read surfaced match context only after approval/introduction. `admin` can read scoped suggestions. |
| Insert | Matching service via `service_role` only. |
| Update | Matching service or `steward` workflow only for recalculation/curation; score changes should be auditable. |
| Delete | Matching service/admin cleanup only; prefer retaining history when reviews or introductions reference suggestions. |
| Gap | RLS is not enabled in the migration and no policies exist. This is a critical production gap because match scores/reasons are sensitive. |

### `steward_reviews`

Stores steward decisions, decision reasons, and links to requests and match suggestions.

| Operation | Expected production access |
| --- | --- |
| Read | Assigned/scoped `steward` and `admin` can read full review data. Request owner may read final status and safe summary, but not necessarily internal decision notes. Helper may read only surfaced approved context. |
| Insert | `steward`, `admin`, or matching/review service for scoped requests. |
| Update | Assigned/scoped `steward` or `admin` can update status and decision reason through workflow actions. |
| Delete | `admin`/retention job only; normal corrections should be new decisions or audited updates, not deletes. |
| Gap | RLS is enabled but no policies exist. Add steward/admin workflow policies and separate safe read surfaces for participants. |

### `introductions`

Stores approved introduction records, participants, status, and context.

| Operation | Expected production access |
| --- | --- |
| Read | Requester, helper, creating steward, scoped `steward`, and `admin` can read relevant introduction records. |
| Insert | `steward`/`admin` or trusted server workflow after review approval. |
| Update | Participants may update limited status fields if product requirements allow. Creating/scoped `steward` and `admin` can coordinate status transitions. |
| Delete | `admin`/retention job only; prefer canceled status over delete. |
| Gap | RLS is enabled but no policies exist. Add participant/steward/admin read policies and controlled status transition writes. |

## Cross-cutting gaps and recommendations

1. **No explicit RLS policies exist in migrations.** Tables with RLS enabled are currently default-deny for regular clients, which is safe but not production-functional unless every path uses trusted server code.
2. **Two sensitive tables do not enable RLS.** `helper_capabilities` and `match_suggestions` should have RLS enabled before production because they contain private helper preferences, capacity, match scores, reasons, and metadata.
3. **Storage policies are missing.** The `private-resumes` bucket exists, but production needs `storage.objects` policies for owner uploads, owner reads, review-time steward/admin reads, and deletion/retention behavior.
4. **Authorization tests are needed.** Add policy tests for owner isolation, community scoping, steward/admin access, denied anonymous access, denied cross-community access, and denied direct client writes to audit/matching internals.
5. **Prefer server-mediated sensitive workflows.** Invite redemption, role grants, audit writes, match generation, review decisions, and introduction creation should remain behind server actions or backend jobs even after RLS policies exist.
6. **Use safe views or RPCs for partial exposure.** Participant-facing match/review/introduction views should avoid leaking private notes, internal decision reasons, raw audit metadata, resume URLs, token hashes, or contact fields beyond privacy settings.

## Production readiness checklist

- Enable RLS for `helper_capabilities` and `match_suggestions`.
- Add explicit policies for all RLS-enabled application tables.
- Add private resume `storage.objects` policies.
- Add helper functions for `current_identity_id`, scoped role checks, and community membership checks.
- Add automated authorization tests covering anon, owner, member, steward, admin, cross-community users, and service-role workflows.
- Add migration runbook notes for deploying policies without blocking existing server-only flows.
