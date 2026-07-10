import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/health/route';
import { buildHealthResponse } from '@/lib/health/response';

afterEach(() => vi.unstubAllEnvs());

describe('health route', () => {
  it('returns a successful no-store health response', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const response = await GET(new Request('http://localhost/api/health'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body).toMatchObject({ status: 'ok', environment: 'production' });
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('does not leak secret environment values', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-secret');
    vi.stubEnv('DATABASE_URL', 'postgres://secret@example.test/database');
    const serialized = JSON.stringify(buildHealthResponse(new Date('2026-07-09T00:00:00.000Z')));
    expect(serialized).not.toContain('service-role-secret');
    expect(serialized).not.toContain('postgres://secret@example.test/database');
  });
});
