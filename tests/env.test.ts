import { describe, expect, it, vi } from 'vitest';

describe('environment validation', () => {
  it('rejects missing Supabase configuration', async () => {
    vi.resetModules();
    const original = process.env;
    process.env = { ...original, NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '' };
    const { getEnv } = await import('@/lib/env');

    expect(() => getEnv()).toThrow();
    process.env = original;
  });
});
