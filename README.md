# NestJS SaaS Boilerplate

A production-ready, single-tenant NestJS 11 foundation with strict TypeScript, PostgreSQL,
TypeORM, Redis, structured logging, optional Sentry monitoring, health checks, hardened containers, and enforced engineering
workflows. Phase 2 adds fixed RBAC, users, credential authentication, rotating sessions, email
two-step verification, recovery codes, and a correlated SMTP mail worker while preserving the flat
modular-monolith architecture. Phase 3 adds private-by-default resumable file storage, local/S3
provider mobility, a dedicated cleanup worker, and stable public file access.
Phase 4 begins single-workspace team administration with secure, expiring invitations while keeping
the application explicitly single-tenant.

## Requirements

- Node.js 24.19.0 LTS
- Corepack and pnpm 11.21.0
- Docker Desktop or Docker Engine with Compose for the full platform

## Quick start

```powershell
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm docker:up
```

On macOS/Linux, use `cp .env.example .env`. The API listens on `http://localhost:3000` by default.

- Liveness: `GET /health/live`
- Readiness: `GET /health/ready`
- Swagger in development: `/docs` (`SWAGGER_DOCS_ACCESS=public`)
- Mailpit UI in development: `http://localhost:8025`
- Public ready files: `/api/v1/files/public/:publicId`
- Authenticated avatar uploads: `/api/v1/users/me/avatar/uploads`
- Avatar attachment: `PATCH /api/v1/users/me/avatar`
- Invitation acceptance: `POST /api/v1/team/invitations/accept`
- Future business endpoints: `/api/v1`

Useful commands:

```bash
pnpm validate
pnpm readiness:check
pnpm test:e2e
pnpm docker:logs
pnpm scaffold:feature billing --http --persistence --dry-run
pnpm init:project --dry-run
pnpm files:migration:status
```

`pnpm docker:reset -- --confirm` deletes local PostgreSQL and Redis volumes. It is intentionally
guarded and should never be used against a managed environment.

## Design

Features use `controller -> service -> concrete repository -> TypeORM`. See
[`docs/README.md`](docs/README.md) for architecture, API, operations, and governance sources and
[`CONTRIBUTING.md`](CONTRIBUTING.md) for branch, commit, review, and verification rules.
