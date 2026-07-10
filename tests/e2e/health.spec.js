const { test, expect } = require('./fixtures/auth');

test.describe('health route', () => {
  test('returns a browser-readable health payload', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.ok()).toBeTruthy();
    expect(response.headers()['cache-control']).toContain('no-store');

    const body = await response.json();
    expect(body).toMatchObject({
      status: 'ok',
      dependencies: expect.arrayContaining([
        expect.objectContaining({ name: 'supabase' }),
        expect.objectContaining({ name: 'email' }),
      ]),
    });
    expect(typeof body.timestamp).toBe('string');
  });
});
