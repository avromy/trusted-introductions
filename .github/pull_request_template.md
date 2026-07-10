# Summary

<!-- Explain the problem, the chosen solution, and why this PR is the correct boundary. -->

## Scope

**In scope**
- 

**Explicitly out of scope**
- 

## Dependencies and Merge Order

- Depends on: none
- Blocks: none
- Overlaps or supersedes: none
- Required merge order: independent

## Architecture Fit

- Existing modules and patterns reused:
- New abstractions introduced and why:
- Files or domains intentionally not modified:
- ADR required: [ ] No  [ ] Yes, linked here:

## Database and Migration Review

- [ ] No database change
- [ ] Migration is additive and uniquely numbered
- [ ] Existing-data behavior was reviewed
- [ ] Constraints, indexes, foreign keys, cascades, and RLS were reviewed
- [ ] Application types and schema agree
- [ ] Rollback or forward-remediation procedure is documented

Migration notes:

## Security, Privacy, and Trust Review

- [ ] Authorization and ownership checks are enforced server-side
- [ ] RLS or storage policies were added or verified where applicable
- [ ] No secrets, plaintext tokens, private notes, contact details, or message bodies enter logs
- [ ] Privacy settings remain authoritative
- [ ] Public and audit-facing shapes expose only approved fields
- [ ] Errors are non-enumerating where appropriate
- [ ] AI does not write personal endorsements

Security/privacy notes:

## Failure Modes and Operations

- Expected behavior when a dependency is unavailable:
- Retry, idempotency, timeout, and bounded-operation behavior:
- Logging, metrics, or alerting impact:
- Rollback or disable procedure:

## Testing Evidence

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test -- --run`
- [ ] `npm run build`
- [ ] `npm run e2e` when user-visible or browser behavior changed
- [ ] Negative, authorization, privacy, and failure paths covered where applicable

Exact commands and results:

```text

```

## Visual Evidence

<!-- Required for user-facing changes. Include before/after screenshots or explain why not applicable. -->

Not applicable because:

## Documentation and Release Impact

- [ ] README updated if setup or developer workflow changed
- [ ] Architecture/API/database/testing/deployment docs updated where applicable
- [ ] Backlog and milestone status remain accurate
- [ ] Environment variables are documented without secret values
- [ ] Operator or migration runbooks were updated where needed

## Reviewer Checklist

- [ ] Intended scope is complete
- [ ] Diff contains no unrelated business logic
- [ ] No competing implementation already exists
- [ ] Tests verify current behavior, not obsolete behavior
- [ ] CI is green against the current base branch
- [ ] Follow-up work is explicitly recorded and is not hidden launch-critical work
