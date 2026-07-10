# Testing Strategy

## Current Status

The repository has Vitest coverage for domain logic, repositories, server actions, onboarding state, and selected React components. Browser end-to-end (E2E) tests are not enabled yet because the production UX routes and authenticated flows are still evolving.

This strategy intentionally separates durable E2E coverage from brittle full-flow automation. Until routes, copy, and UX states are finalized, browser tests should validate stable route contracts, critical page affordances, and mocked happy-path transitions instead of attempting a complete production journey across every role.

## Required Check Categories

- Formatting.
- Linting.
- Typechecking.
- Unit tests.
- Integration tests for API and database behavior.
- Browser E2E tests for critical cross-role flows once production UX routes stabilize.
- Build verification.

## Current Automated Commands

Run these checks before merging application or test changes:

```bash
npm run typecheck
npm run test -- --run
npm run build
```

## Critical Flows To Test

- Invite creation and redemption.
- Duplicate identity prevention.
- Privacy setting enforcement.
- Job seeker request creation.
- Helper capability updates.
- Match explanation generation.
- Introduction workflow transitions.
- Follow-up reminders and response collection.
- Outcome recording.

## Browser E2E Recommendation

Use [Playwright](https://playwright.dev/) for browser E2E once the production UX routes are finalized. Playwright is the recommended framework because it supports Chromium, Firefox, and WebKit; provides reliable auto-waiting; can run authenticated storage-state scenarios; and integrates cleanly with Next.js by starting the app through a `webServer` command.

No Playwright dependency or config is added in this task. Adding the framework now would introduce package and lockfile churn before stable route contracts exist, while creating placeholder tests would encourage brittle selectors and full-flow assumptions. The initial scaffold is therefore documentation-only and should be converted to executable tests when each route below has stable semantics and test fixtures.

When enabling Playwright, prefer the smallest safe setup:

```bash
npm install --save-dev @playwright/test
npx playwright install --with-deps chromium
```

Suggested initial config:

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

Add an `e2e` script only after the first durable tests land:

```json
{
  "scripts": {
    "test:e2e": "playwright test"
  }
}
```

## Browser E2E Coverage Plan

### 1. Invite

**Goal:** Verify that trusted community entry points work without leaking invite secrets.

- Steward or authorized actor can open the invite creation surface.
- Required invite fields validate in the browser.
- Successful invite creation shows a shareable redemption affordance without exposing plaintext tokens in server-rendered history or logs.
- Invite redemption route handles valid, expired, revoked, and already-used states with user-safe messaging.

**Scaffold approach:** Start with route-smoke tests for invite creation and redemption states using seeded fixtures or mocked service responses. Avoid asserting exact copy until UX content is finalized.

### 2. Onboarding

**Goal:** Verify that a redeemed or authenticated user can complete role-aware onboarding.

- User can identify as job seeker, helper, steward, or a supported combination.
- Required profile fields and duplicate identity checks surface actionable validation.
- Privacy defaults are visible and can be adjusted before completion.
- Completed onboarding lands on the correct role dashboard.

**Scaffold approach:** Use storage-state authentication fixtures and deterministic profile fixtures. Assert durable headings, form roles, and navigation outcomes rather than implementation-specific component structure.

### 3. Seeker Request

**Goal:** Verify that a job seeker can create and manage a request for help.

- Job seeker can open the request creation route.
- Required request fields validate client-visible errors.
- Saved request appears in seeker-facing dashboard or request list.
- Privacy settings continue to hide sensitive contact or resume data unless explicitly shared.

**Scaffold approach:** Cover one minimal valid request fixture and one validation failure fixture. Keep matching outcomes mocked or fixture-driven until matching UX is finalized.

### 4. Helper Capability

**Goal:** Verify that helpers can declare the types of support they can provide.

- Helper can open the capability settings route.
- Helper can add, update, and remove capability details.
- Saved capabilities are visible after reload.
- Capability changes do not expose private helper notes to seekers.

**Scaffold approach:** Test form persistence through stable labels and role-based navigation. Avoid relying on final taxonomy labels until the capability model is locked.

### 5. Steward Review

**Goal:** Verify that stewards can review suggested matches and make trust-preserving decisions.

- Steward can view pending match or introduction candidates.
- Review page shows explanation, relevant seeker need, and helper capability summary.
- Steward can approve, reject, or request more information.
- Rejected or deferred items leave an audit-visible state without notifying unintended parties.

**Scaffold approach:** Seed review candidates directly through test fixtures. Do not create them through the full seeker-helper matching flow until production matching UX is stable.

### 6. Introduction

**Goal:** Verify that approved introductions can be initiated and viewed by the right participants.

- Steward can initiate an introduction from an approved review.
- Seeker and helper can view introduction details appropriate to their role.
- Public or meet-page links respect opt-in and revocation settings.
- Unauthorized users receive safe not-found or access-denied states.

**Scaffold approach:** Use fixture-created introduction records and assert role-specific visibility. Avoid brittle email, notification, or external calendar assertions unless those integrations are explicitly testable in CI.

### 7. Follow-up

**Goal:** Verify that the product can collect post-introduction follow-up signals.

- Participant can open a follow-up route for an eligible introduction.
- Follow-up form records whether contact happened and whether additional help is needed.
- Completed follow-up cannot be duplicated unless the product explicitly supports updates.
- Steward-visible follow-up state is updated without exposing private participant feedback to the wrong role.

**Scaffold approach:** Start with seeded eligible and ineligible introductions. Assert status transitions and access control, not final reminder timing behavior.

### 8. Outcome

**Goal:** Verify that introduction outcomes can be recorded for learning and accountability.

- Eligible participant or steward can open the outcome route.
- Required outcome fields validate clearly.
- Saved outcome is reflected in steward or participant summary views.
- Sensitive outcome notes follow privacy and audit rules.

**Scaffold approach:** Seed completed-introduction fixtures and submit a minimal positive, neutral, and no-response outcome. Avoid testing final analytics dashboards until reporting UX exists.

## E2E Scaffold Standards

When executable E2E tests are added:

- Store tests under `tests/e2e/` and name files by stable journey, for example `invite.spec.ts` or `steward-review.spec.ts`.
- Prefer role fixtures such as `seekerPage`, `helperPage`, and `stewardPage` over logging in through the UI in every test.
- Seed data through repository, API, or database helpers rather than relying on previous tests.
- Use accessible selectors (`getByRole`, `getByLabel`, `getByText` for durable user-facing states) and avoid CSS class selectors.
- Mark intentionally incomplete journeys with `test.describe` planning notes in docs, not skipped tests in CI.
- Keep each test focused on one browser-observable contract.
- Do not automate the full invite → onboarding → seeker request → helper capability → steward review → introduction → follow-up → outcome path until production UX routes and copy are finalized.

## Security and Privacy Tests

- Hidden resources must not leak through API errors.
- Resume/contact visibility must follow privacy settings.
- Invite tokens must not be stored in plaintext.
- Public meet pages must be opt-in and revocable.
- Role-specific browser pages must not expose seeker, helper, steward, follow-up, or outcome details to unauthorized users.
