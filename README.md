# Trusted Introductions

Trusted Introductions is a private, invite-only Jewish community job-helping platform. It helps trusted community members support job seekers through warm introductions, network sharing, guidance, and tracked outcomes.

The product is **not** a recruiting platform, job board, or applicant tracking system. Its core loop is:

> Invite → Onboard → Match → Help → Track Outcome

## Current Repository Status

The engineering source of truth lives in [`/docs`](docs/). The repository now has the MVP core reconciled: M1 foundation, M2 invite-only onboarding, M3 matching foundation, and M4 introduction/follow-up/outcome coverage are complete for MVP. Production hardening remains before broad rollout.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, PostgreSQL, and Storage
- Vitest and Testing Library
- ESLint and Prettier

## Local Setup

```bash
git clone <repo-url>
cd trusted-introductions
npm install
cp .env.example .env.local
```

Update `.env.local` with Supabase values. For local Supabase, run the Supabase CLI and copy the generated anon and service role keys into `.env.local`.

Required environment variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_RESUME_BUCKET`

## Development Commands

```bash
npm run dev          # start the app locally
npm run lint         # run Next.js ESLint checks
npm run typecheck    # run TypeScript without emitting files
npm run test         # run unit tests
npm run build        # create a production build
npm run format:check # verify Prettier formatting
```

## Supabase

Supabase project configuration is in [`supabase/config.toml`](supabase/config.toml). The initial foundation migration enables `pgcrypto` and creates a private `private-resumes` storage bucket. Additive MVP migrations/types cover invite-only onboarding, seeker request persistence, helper capabilities, match suggestions, steward reviews, and introductions; durable follow-up reminder and outcome tables remain documented as hardening work.

Apply migrations with the Supabase CLI when a local project is running:

```bash
supabase start
supabase db reset
```

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
