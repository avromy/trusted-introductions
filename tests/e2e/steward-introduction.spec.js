const { test, expect } = require('./fixtures/auth');

test.describe('steward review and introduction access', () => {
  test('ordinary users cannot access the steward match review surface', async ({ page }) => {
    const response = await page.goto('/steward/requests/e2e-request/matches');
    expect(response && response.status()).toBeLessThan(500);
    await expect(page.getByRole('heading', { name: 'Steward access required' })).toBeVisible();
    await expect(page.getByText(/active steward or admin role/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create introduction' })).toHaveCount(0);
  });
});
