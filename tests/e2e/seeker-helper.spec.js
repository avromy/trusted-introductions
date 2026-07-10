const { test, expect } = require('./fixtures/auth');

test.describe('seeker and helper intake routes', () => {
  test('seeker request form exposes required production fields', async ({ page }) => {
    await page.goto('/requests/new');
    await expect(page.getByRole('heading', { name: 'Request trusted introductions' })).toBeVisible();
    await expect(page.getByLabel(/headline/i)).toBeVisible();
    await expect(page.getByLabel(/target role/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /submit|save|create/i })).toBeVisible();
  });

  test('helper capability form identifies private notes as non-public', async ({ page }) => {
    await page.goto('/helper/capabilities');
    await expect(page.getByRole('heading', { name: /helper|ways you can help/i })).toBeVisible();
    await expect(page.getByLabel(/availability/i)).toBeVisible();
    await expect(page.getByLabel(/weekly intro capacity/i)).toBeVisible();
    await expect(page.getByText(/private|steward/i)).toBeVisible();
  });
});
