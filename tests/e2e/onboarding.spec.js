const { test, expect } = require('./fixtures/auth');

test.describe('invite and onboarding routes', () => {
  test('missing invite token is blocked from continuing', async ({ page }) => {
    const response = await page.goto('/onboarding/invite');
    expect(response && response.status()).toBeLessThan(500);
    await expect(page.getByRole('heading', { name: 'Start with a trusted invitation' })).toBeVisible();
    await expect(page.getByText('Open this page from your invite link')).toBeVisible();
    await expect(page.getByRole('link', { name: /Continue onboarding/i })).toHaveCount(0);
  });
});
