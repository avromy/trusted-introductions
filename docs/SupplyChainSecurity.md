# Supply Chain Security

## Merge gates

- A committed npm lockfile is required for deterministic dependency installation.
- CI uses `npm ci` after the lockfile is committed.
- Dependency Review blocks newly introduced high or critical vulnerabilities.
- GPL-3.0 and AGPL-3.0 dependencies require explicit legal approval before merge.
- CodeQL runs on every pull request, on main, and weekly.
- Dependabot opens grouped weekly npm and GitHub Actions updates.

## Vulnerability response

Critical vulnerabilities in production dependencies block release and require immediate triage. High-severity vulnerabilities block new dependency introduction and require remediation or a documented, time-bounded exception. Medium and low findings are reviewed for exploitability and exposure.

Exceptions must identify the package, advisory, affected surface, compensating control, owner, expiration date, and remediation plan.

## Dependency changes

Every dependency PR must state why the package is needed, whether an existing dependency can satisfy the requirement, bundle or runtime impact, license, security posture, and removal plan if experimental.
