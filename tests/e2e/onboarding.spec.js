const { test, expect } = require('./fixtures/auth');

test.describe('invite and onboarding routes', () => {
  test('missing invite token is blocked from continuing', async ({ page }) => {
    await page.goto('/onboarding/invite');
    await expect(page.getByRole('heading', { name: 'Start with a trusted invitation' })).toBeVisible();
    await expect(page.getByText('Open this page from your invite link')).toBeVisible();
    await expect(page.getByRole('link', { name: /Continue onboarding/i })).toHaveCount(0);
  });

  test('role and profile routes expose production onboarding controls', async ({ page }) => {
    await page.goto('/onboarding/role');
    await expect(page.getByRole('heading', { name: /Choose how you want to participate/i })).toBeVisible();
    await expect(page.getByText('Both')).toBeVisible();

    await page.goto('/onboarding/profile');
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();
    await expect(page.getByLabel(/Display name/i)).toBeVisible();
  });
});
