# Trusted Introductions

Trusted Introductions is a private, invite-only Jewish community job-helping platform. It helps trusted community members support job seekers through warm introductions, network sharing, guidance, and tracked outcomes.

The product is **not** a recruiting platform, job board, or applicant tracking system. Its core loop is:

> Invite → Onboard → Match → Help → Track Outcome

## Current Repository Status

This repository is in an early migration state. The engineering source of truth now lives in [`/docs`](docs/), with architecture, product requirements, standards, risks, roadmap, milestones, and handoff guidance documented there.

No runnable application source code is currently present in the repository. The next implementation milestone is to select and scaffold the minimum viable application stack described in the documentation, then implement invite-only onboarding and trusted identity foundations.

## Product Principles

- One person. One trusted identity. Multiple ways to contribute.
- Trust over scale.
- Human before résumé.
- Match people to trusted access, not jobs.
- Preserve the human bridge.
- Explain every recommendation.
- Measure outcomes, not activity.
- Privacy settings override convenience.
- AI must not write the helper’s personal endorsement.

## Documentation Map

Start here when joining the project or opening a new Codex session:

- [Audit](docs/Audit.md) — current repository inventory and gaps.
- [PRD](docs/PRD.md) — product goals, users, scope, and non-goals.
- [Architecture](docs/Architecture.md) — current and target system architecture.
- [Database Schema](docs/DatabaseSchema.md) — proposed domain model and tables.
- [API](docs/API.md) — proposed API boundaries and endpoints.
- [Engineering Standards](docs/EngineeringStandards.md) — development rules and quality bar.
- [UX Principles](docs/UXPrinciples.md) — product experience guidance.
- [Design System](docs/DesignSystem.md) — visual and interaction foundations.
- [Roadmap](docs/Roadmap.md) — phased product direction.
- [Milestones](docs/Milestones.md) — current implementation milestones.
- [Backlog](docs/Backlog.md) — prioritized engineering tasks.
- [Testing Strategy](docs/TestingStrategy.md) — expected test coverage and checks.
- [Deployment](docs/Deployment.md) — deployment assumptions and runbook.
- [Contributing](docs/Contributing.md) — contribution workflow.
- [Technical Decisions](docs/TechnicalDecisions/) — ADRs.
- [Engineering Handoff Template](docs/handoffs/EngineeringHandoffTemplate.md) — session handoff format.

## How to Run It

There is not yet an application to run. For now:

```bash
git clone <repo-url>
cd trusted-introductions
cp .env.example .env
```

Once the application is scaffolded, update this section with the package manager, install command, dev server command, database setup, migrations, tests, linting, typecheck, and build commands.

## CI / Build Status

A placeholder CI workflow exists at [`.github/workflows/ci.yml`](.github/workflows/ci.yml). It currently validates that required documentation exists. When application code is added, CI must be expanded to run install, lint, typecheck, tests, migrations, and build.

## Current Milestones

1. **M0 — Repository operating system:** documentation, ADRs, handoff template, contribution workflow, and CI baseline.
2. **M1 — Application foundation:** scaffold app, auth, database, environments, and deployment path.
3. **M2 — Invite-only onboarding:** invite creation, invite redemption, trusted identity profile, and privacy preferences.
4. **M3 — Matching foundation:** helper/job-seeker signals, explainable recommendations, and manual review.
5. **M4 — Help and outcome tracking:** introductions, follow-ups, outcomes, and community health reporting.

See [Milestones](docs/Milestones.md) and [Roadmap](docs/Roadmap.md) for details.

## Current Technical Risks

- The runnable application stack has not been selected or scaffolded.
- Identity, privacy, and invite decisions are documented as initial ADRs but not yet implemented.
- Resume handling and public meet pages require careful privacy controls before launch.
- Matching recommendations must be explainable and auditable.
- AI features must avoid generating personal endorsements on behalf of helpers.

See [Audit](docs/Audit.md), [Architecture](docs/Architecture.md), and [Backlog](docs/Backlog.md) for more detail.

## How to Continue Development

1. Read this README and the `/docs` index above.
2. Review [Audit](docs/Audit.md) for the current repository state.
3. Review [Milestones](docs/Milestones.md) and pick the next unblocked milestone task.
4. Record significant technical decisions as ADRs in `docs/TechnicalDecisions/`.
5. Keep implementation, docs, `.env.example`, CI, and handoff notes synchronized.
6. Before opening a PR, run all available checks and fill out the PR template.
