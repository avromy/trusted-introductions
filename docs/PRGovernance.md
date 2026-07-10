# Pull Request Governance

## Purpose

This policy prevents duplicate systems, conflict-heavy batches, false completion claims, and unsafe merges while allowing multiple Codex accounts or engineers to work in parallel.

## Task Design

Each task must declare:

- primary owner and account;
- exact files or domain boundary it should own;
- prohibited overlapping files;
- dependencies on prior tasks;
- expected tests;
- whether it creates a migration;
- whether it changes a public contract;
- the required PR title.

Parallel batches should be split by durable ownership boundaries, such as product routes versus platform modules, rather than arbitrary task counts.

## PR States

- **Draft:** implementation or evidence is incomplete.
- **Ready for review:** scope complete, description complete, and author checks passed.
- **Merge after fix:** architecture is acceptable but a concrete defect remains.
- **Replace:** branch cannot be reconciled safely or contains inseparable invalid architecture.
- **Duplicate:** no unique required work exists.
- **Superseded:** unique work is verified in a named replacement PR or on `main`.

## Review Sequence

1. Reconcile purpose against current `main`.
2. Compare overlapping PRs before reviewing implementation details.
3. Inspect changed files and scope drift.
4. Review architecture, security, privacy, migrations, and operations.
5. Review tests and exact CI evidence.
6. Determine dependency-aware merge order.
7. Merge one PR at a time.
8. Refresh remaining PRs after every merge.
9. Re-run checks on updated or replacement branches.
10. Close duplicates only after preservation is verified.

## Merge Standard

Use squash merge unless preserving a meaningful commit series is explicitly justified. Merge only when:

- intended scope is complete;
- no unrelated business logic is included;
- implementation fits current architecture;
- security and privacy findings are resolved;
- required checks pass against current `main`;
- migration and rollback implications are understood;
- documentation is accurate;
- the PR is mergeable and not stale.

## Batch Reconciliation

After every batch, verify independently:

### GitHub state

- intended PRs merged;
- no stale drafts or duplicates remain;
- replacement and supersession reasons are explicit;
- required work is not stranded on branches.

### Repository state

- expected capabilities exist on `main`;
- exports, types, schema, and documentation agree;
- no duplicate helpers or competing implementations remain;
- tests target current behavior.

### Release state

- CI passes;
- migrations are ordered;
- environment and external dependencies are identified;
- launch blockers remain explicit rather than buried in follow-up notes.

## Codex Prompt Requirement

Every implementation prompt must end by requiring lint, typecheck, unit tests, build, branch creation, push, PR creation, summary, and test evidence. Prompts that touch browser workflows must also require E2E. Prompts that touch the database must require schema/type reconciliation and policy tests.
