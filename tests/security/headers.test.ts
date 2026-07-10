import { describe, expect, it } from 'vitest';

import { contentSecurityPolicy, securityHeaders } from '@/lib/security-headers.mjs';

const headers = new Map(securityHeaders.map(({ key, value }) => [key, value]));

describe('security headers', () => {
  it('defines production security headers for every route', () => {
    expect(headers.get('Content-Security-Policy')).toBe(contentSecurityPolicy);
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Strict-Transport-Security')).toContain('includeSubDomains');
    expect(headers.get('Permissions-Policy')).toContain('camera=()');
  });

  it('keeps the CSP restrictive while allowing required Supabase connections', () => {
    expect(contentSecurityPolicy).toContain("default-src 'self'");
    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
    expect(contentSecurityPolicy).toContain("object-src 'none'");
    expect(contentSecurityPolicy).toContain('https://*.supabase.co');
    expect(contentSecurityPolicy).toContain('wss://*.supabase.co');
    expect(contentSecurityPolicy).not.toContain("'unsafe-inline'");
    expect(contentSecurityPolicy).not.toContain(' *');
  });
});
