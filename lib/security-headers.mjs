const supabaseConnectSrc = ['https://*.supabase.co', 'wss://*.supabase.co'];

const contentSecurityPolicyDirectives = [
  ['default-src', ["'self'"]],
  ['base-uri', ["'self'"]],
  ['object-src', ["'none'"]],
  ['frame-ancestors', ["'none'"]],
  ['form-action', ["'self'"]],
  ['script-src', ["'self'"]],
  ['style-src', ["'self'"]],
  ['img-src', ["'self'", 'data:', 'blob:', 'https://*.supabase.co']],
  ['font-src', ["'self'"]],
  ['connect-src', ["'self'", ...supabaseConnectSrc]],
  ['worker-src', ["'self'", 'blob:']],
  ['manifest-src', ["'self'"]],
  ['upgrade-insecure-requests', []],
];

export const contentSecurityPolicy = contentSecurityPolicyDirectives
  .map(([directive, values]) => (values.length > 0 ? `${directive} ${values.join(' ')}` : directive))
  .join('; ');

export const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: contentSecurityPolicy,
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];
