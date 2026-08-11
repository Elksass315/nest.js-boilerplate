# Configuration and Operations

## Configuration contract

Copy `.env.example` only for local development. Staging and production values come from the
deployment host's managed secret mechanism and are never committed.

The application validates configuration before connecting to dependencies. Important rules:

- `NODE_ENV` is `development`, `test`, `staging`, or `production`.
- `SWAGGER_ENABLED` must be false in production.
- Database passwords contain at least 12 characters.
- Redis passwords contain at least 16 characters in staging and production.
- TypeORM synchronization and startup migrations are prohibited.
- `CORS_ORIGINS` is a comma-separated explicit allowlist; wildcard origins are unsupported.

Keep the same environment key names across all environments. If a new key is required, update the
schema, `.env.example`, tests, this document, Compose/Jenkins wiring when relevant, and deployment
secrets in the same change.

## Local Docker workflow

The base Compose model defines the API, PostgreSQL, Redis, private service network, persistent
volumes, and health checks. `compose.dev.yaml` adds source mounting, hot reload, and local ports.

```bash
pnpm docker:config
pnpm docker:up
pnpm docker:ps
pnpm docker:logs
pnpm docker:down
```

The runtime image contains compiled production code and production dependencies only. Deployment
adds a read-only root filesystem, dropped capabilities, `no-new-privileges`, and bounded temporary
storage.

## CI/CD and environments

- GitHub Actions validates pull requests, runs security checks, creates semantic releases, and
  publishes one immutable GHCR image.
- Jenkins accepts the published digest and deploys it; it never builds source code.
- `develop` deploys to development, `release/*` to staging, and `main` to production after approval.

Jenkins expects an external `.env` at `/srv/nestjs-saas/<environment>/.env`. GitHub repository
secrets provide the Jenkins URL/API credentials, and GHCR authentication is configured on the
Jenkins deploy agent.

Deployment order is pull image, run the one-shot migration service, start without building, wait
for readiness, and smoke-test. The prior digest is restored automatically on failure.

## Package and security maintenance

Dependabot checks pnpm, GitHub Actions, and Docker weekly. Pull requests block on high/critical
production advisories, dependency-review policy, secret scanning, and fixable image findings.
Main and scheduled workflows add CodeQL, SBOM generation, license validation, and deep filesystem
scanning. Exceptions require an owner, rationale, expiry date, and remediation issue.
