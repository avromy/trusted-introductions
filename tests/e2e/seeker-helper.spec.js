const { test, expect } = require('./fixtures/auth');

test.describe('seeker and helper intake routes', () => {
  test('seeker request route renders the production intake surface', async ({ page }) => {
    const response = await page.goto('/requests/new');
    expect(response && response.status()).toBeLessThan(500);
    await expect(page.getByRole('heading', { name: 'Request trusted introductions' })).toBeVisible();
    await expect(page.locator('form')).toHaveCount(1);
  });

  test('helper capability route renders the private-aware intake surface', async ({ page }) => {
    const response = await page.goto('/helper/capabilities');
    expect(response && response.status()).toBeLessThan(500);
    await expect(page.getByRole('heading', { name: 'Describe how you can help' })).toBeVisible();
    await expect(page.locator('form')).toHaveCount(1);
    await expect(page.getByText(/private|steward/i).first()).toBeVisible();
  });
});
