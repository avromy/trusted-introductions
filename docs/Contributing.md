# Contributing

## Required Workflow

1. Reconcile `main`, open PRs, recent merged work, milestones, and the backlog before defining a task.
2. Confirm the intended work does not already exist under another route, helper, migration, test, or branch.
3. Create one focused branch for one coherent change.
4. State explicit in-scope and out-of-scope boundaries before implementation.
5. Reuse existing domain modules, repositories, validation, authorization, logging, and UI patterns.
6. Update tests and documentation in the same PR.
7. Run every required check locally or provide exact CI evidence.
8. Open the PR using the full template. A PR description is part of the engineering deliverable.

## PR Size and Boundaries

Prefer PRs that can be reviewed as one architectural decision. A PR should normally:

- modify one primary product or platform boundary;
- avoid unrelated cleanup;
- avoid introducing a second implementation of an existing abstraction;
- avoid combining schema design, provider integration, broad UX redesign, and documentation reconciliation unless they are inseparable;
- identify dependencies and merge order explicitly.

Large PRs are acceptable only when splitting them would create unsafe partial states. Explain that constraint in the PR.

## Definition of Done

A task is not done because code exists or CI is green. It is done only when:

- the complete intended behavior exists on the branch;
- authorization, privacy, failure, and negative paths are covered;
- database and application types agree;
- migrations are additive, ordered, and reviewed for existing data;
- operations and rollback behavior are understood;
- documentation describes the integrated behavior accurately;
- the PR is current with `main`, mergeable, and reviewable;
- no required work is hidden in a stale or superseded branch.

## Testing Standard

Run:

```bash
npm run lint
npm run typecheck
npm run test -- --run
npm run build
```

Run `npm run e2e` for route, form, browser, authentication, or user-visible workflow changes.

Tests must target the current architecture. When persistence changes, update mocks and assertions to prove both durable state and privacy-safe audit behavior. Passing obsolete tests is not a quality signal.

## Database and Security Changes

Any PR touching migrations, authentication, authorization, RLS, storage, internal routes, tokens, notifications, or sensitive serialization must document:

- threat and ownership assumptions;
- least-privilege behavior;
- existing-data impact;
- indexes, constraints, and cascade behavior;
- rollback or forward remediation;
- tests for owner, unauthorized, cross-community, steward, and admin cases where applicable.

## Duplicate and Replacement Work

Never close a conflicted, obsolete, or duplicate PR until its unique intended work is verified on `main` or preserved in a reviewed replacement PR. Replacement PRs must name every PR they supersede and explain what was retained or intentionally rejected.

## Decision Records

Create an ADR in `docs/TechnicalDecisions/` for significant product, architecture, privacy, data-model, vendor, or operational decisions.

## Handoffs

Use `docs/handoffs/EngineeringHandoffTemplate.md` when pausing work or transferring context to another engineer or Codex session. The handoff must identify exact branch and PR state, completed verification, unresolved risks, and next dependency-aware action.
