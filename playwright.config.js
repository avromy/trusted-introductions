const { defineConfig, devices } = require('@playwright/test');

const port = Number(process.env.E2E_PORT ?? 3000);
const host = process.env.E2E_HOST ?? '127.0.0.1';
const baseURL = process.env.E2E_BASE_URL ?? `http://${host}:${port}`;

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    timezoneId: 'UTC',
    locale: 'en-US',
  },
  webServer: {
    command: `NEXT_PUBLIC_APP_URL=${baseURL} NEXT_PUBLIC_SUPABASE_URL=${process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'} NEXT_PUBLIC_SUPABASE_ANON_KEY=${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'local-e2e-anon-key'} SUPABASE_SERVICE_ROLE_KEY=${process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'local-e2e-service-role-key'} SUPABASE_STORAGE_RESUME_BUCKET=${process.env.SUPABASE_STORAGE_RESUME_BUCKET ?? 'private-resumes'} npm run dev -- --hostname ${host} --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
