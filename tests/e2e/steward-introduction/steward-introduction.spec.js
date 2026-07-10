const { test, expect, seedAuthenticatedSession } = require('../fixtures/auth');
const { cleanupE2ERecords } = require('../fixtures/data');

test.describe.configure({ mode: 'serial' });

test.describe('steward review and introduction creation', () => {
  test.afterEach(async () => {
    await cleanupE2ERecords();
  });

  test('authorized steward views match suggestions and explanations', async ({ page, context }) => {
    await seedAuthenticatedSession(context, 'steward');
    await page.goto('/steward/requests/e2e-request-with-matches/matches');

    await expect(page.getByRole('heading', { name: 'Match suggestions' })).toBeVisible();
    await expect(page.getByText('#1 helper e2e-helper-approved')).toBeVisible();
    await expect(page.getByText('Matches desired help: network_introduction.')).toBeVisible();
    await expect(page.getByText('Matches communities: Remote.')).toBeVisible();
    await expect(page.getByText('No scoring reasons were recorded for this suggestion.')).toBeVisible();
  });

  test('renders empty match state', async ({ page, context }) => {
    await seedAuthenticatedSession(context, 'steward');
    await page.goto('/steward/requests/e2e-request-empty/matches');

    await expect(page.getByText('Empty queue')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No matches to review yet' })).toBeVisible();
  });

  test('recalculates matches for a request', async ({ page, context }) => {
    await seedAuthenticatedSession(context, 'steward');
    await page.goto('/steward/requests/e2e-request-empty/matches');
    await page.getByRole('button', { name: 'Recalculate matches' }).click();

    await expect(page.getByText('#1 helper e2e-helper-approved')).toBeVisible();
    await expect(page.getByText(/Matches help type: network_introduction/)).toBeVisible();
  });

  test('records approve, reject, and needs-information decisions with status changes', async ({ page, context }) => {
    await seedAuthenticatedSession(context, 'steward');
    await page.goto('/steward/requests/e2e-request-with-matches/matches');

    await page.locator('form').filter({ hasText: 'Approve' }).first().getByLabel('Decision note').fill('Strong fit for climate introductions');
    await page.locator('form').filter({ hasText: 'Approve' }).first().getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Approved').first()).toBeVisible();
    await expect(page.getByText('Decision note: Strong fit for climate introductions')).toBeVisible();

    await page.locator('form').filter({ hasText: 'Reject' }).first().getByLabel('Decision note').fill('Not enough availability');
    await page.locator('form').filter({ hasText: 'Reject' }).first().getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByText('Rejected')).toBeVisible();
    await expect(page.getByText('Decision note: Not enough availability')).toBeVisible();

    await page.locator('form').filter({ hasText: 'Needs info' }).first().getByLabel('Decision note').fill('Confirm helper capacity first');
    await page.locator('form').filter({ hasText: 'Needs info' }).first().getByRole('button', { name: 'Needs info' }).click();
    await expect(page.getByText('Needs info')).toBeVisible();
    await expect(page.getByText('Decision note: Confirm helper capacity first')).toBeVisible();
  });

  test('protects finalized decisions from further changes', async ({ page, context }) => {
    await seedAuthenticatedSession(context, 'steward');
    await page.goto('/steward/requests/e2e-request-with-matches/matches');

    await expect(page.getByText('This steward decision is finalized and cannot be changed.').first()).toBeVisible();
    await expect(page.getByText('Approved').first()).toBeVisible();
  });

  test('creates an introduction from an approved match and shows only safe context', async ({ page, context }) => {
    await seedAuthenticatedSession(context, 'steward');
    await page.goto('/steward/requests/e2e-request-with-matches/matches');

    await expect(page.getByRole('button', { name: 'Create introduction' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Create introduction' }).first().click();
    await page.goto('/steward/introductions/e2e-introduction-safe');

    await expect(page.getByText('Steward introduction')).toBeVisible();
    await expect(page.getByText('Safe introduction context')).toBeVisible();
    await expect(page.getByText('messageContentStored')).toBeVisible();
    await expect(page.getByText('SECRET RAW MESSAGE')).toHaveCount(0);
    await expect(page.getByText('rawIntroductionMessage')).toHaveCount(0);
  });

  test('does not offer introduction creation for unapproved or invalid matches', async ({ page, context }) => {
    await seedAuthenticatedSession(context, 'steward');
    await page.goto('/steward/requests/e2e-request-with-matches/matches');

    await expect(page.getByText('#2 helper e2e-helper-rejected').locator('..').getByRole('button', { name: 'Create introduction' })).toHaveCount(0);
    await expect(page.getByText('#3 helper e2e-helper-info').locator('..').getByRole('button', { name: 'Create introduction' })).toHaveCount(0);
  });

  test('blocks unauthorized non-steward access', async ({ page, context }) => {
    await seedAuthenticatedSession(context, 'seeker');
    await page.goto('/steward/requests/e2e-request-with-matches/matches');

    await expect(page.getByRole('heading', { name: 'Steward access required' })).toBeVisible();
    await expect(page.getByText('You need an active steward or admin role')).toBeVisible();
  });
});
