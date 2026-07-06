# Deployment

## Status

No deployable application exists yet.

## Requirements

- Separate development, staging, and production environments.
- Managed relational database with backups.
- Secret management outside source control.
- CI checks before deployment.
- Migration runbook.
- Rollback plan.
- Basic observability for errors, latency, background jobs, and email delivery.

## Environment Variables

See `.env.example` for proposed variables. Update both this document and `.env.example` when implementation choices change.
