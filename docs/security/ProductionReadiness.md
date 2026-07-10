# Production Readiness Security Notes

Trusted Introductions is moving toward production readiness, but this document is not a production certification. The application handles sensitive community, identity, introduction, and resume data; each release still requires human review and operational sign-off.

## HTTP Security Headers

The Next.js configuration applies focused security headers to all routes:

- `Content-Security-Policy` defaults to same-origin resources, blocks object embedding, denies framing with `frame-ancestors 'none'`, and permits Supabase HTTPS and websocket endpoints needed by `@supabase/supabase-js`.
- `Referrer-Policy: strict-origin-when-cross-origin` reduces cross-origin URL leakage while preserving useful origin-level analytics and debugging context.
- `X-Content-Type-Options: nosniff` prevents MIME sniffing.
- `X-Frame-Options: DENY` provides legacy clickjacking protection alongside CSP `frame-ancestors`.
- `Permissions-Policy` disables camera, microphone, geolocation, payment, USB, and browsing topics by default.
- `Strict-Transport-Security` assumes production is served only over HTTPS with subdomains included.

The CSP intentionally avoids `unsafe-inline` and broad `*` wildcards. Supabase domains are the only cross-origin network allowance because authentication, database, storage, and realtime clients may communicate with the hosted Supabase API over HTTPS and websockets. Revisit the policy before adding analytics, error reporting, third-party fonts, embeds, or external image providers.

## Release Gates

Pull requests and main-branch pushes run environment-variable presence validation, lint, typecheck, unit tests, build, and configured Playwright browser E2E checks. Environment validation reports only variable names that are missing; it must not print secret values. Lockfile-backed dependency installation and dependency audit should be added once the repository has a committed lockfile that can be maintained without registry-policy noise.

## Remaining Manual Reviews

Before any broad production rollout, complete and record these manual reviews:

- Load and concurrency testing for invite redemption, onboarding, matching, steward review, introductions, follow-ups, outcomes, and resume access.
- Penetration testing and security review of authentication, authorization, RLS assumptions, storage access, and sensitive route behavior.
- Backup and restore drills covering Supabase database data and private resume storage.
- Privacy review for data retention, user consent, steward visibility, exports, deletion workflows, and incident communications.
