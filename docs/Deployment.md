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

## Health Checks

The application exposes a lightweight production health check at `/api/health`. Configure load balancers, uptime monitors, and platform health probes to send a `GET` request to this path.

A successful response returns HTTP `200` with JSON containing:

- `status`: the application status, currently `ok`.
- `timestamp`: the server timestamp for the response.
- `environment`: a safe environment label when available from non-secret runtime metadata such as `VERCEL_ENV` or `NODE_ENV`.
- `dependencies`: placeholder dependency checks for services such as Supabase and email delivery.

The health route intentionally avoids returning environment variables, credentials, connection strings, or other secrets. Dependency entries are placeholders until active downstream checks are added.

Example:

```bash
curl -fsS https://your-app.example.com/api/health
```

## Environment Variables

See `.env.example` for proposed variables. Update both this document and `.env.example` when implementation choices change.
