# NestJS SaaS Boilerplate

A production-oriented, single-tenant NestJS 11 foundation with strict TypeScript, PostgreSQL,
TypeORM, Redis, structured logging, health checks, hardened containers, and enforced engineering
workflows. The fully wired reference profile includes fixed
RBAC, users, credential authentication, rotating sessions, email two-step verification, recovery
codes, team invitations, feature flags, transactional mail/outbox delivery, private-by-default
resumable file storage, local/S3 provider mobility, and dedicated mail, file, outbox, and retention
workers. The initializer supports every dependency-valid combination of the optional capabilities.

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

<!-- capability:files:start -->

- Public ready files: `/api/v1/files/public/:publicId`

<!-- capability:files:end -->
<!-- capability:user-avatars:start -->

- Authenticated avatar uploads: `/api/v1/users/me/avatar/uploads`
- Avatar attachment: `PATCH /api/v1/users/me/avatar`

<!-- capability:user-avatars:end -->
<!-- capability:invitations:start -->

- Invitation acceptance: `POST /api/v1/team/invitations/accept`

<!-- capability:invitations:end -->

- Future business endpoints: `/api/v1`

Useful commands:

```bash
pnpm validate
pnpm readiness:check
pnpm test:e2e
pnpm docker:logs
pnpm scaffold:feature billing --http --persistence --dry-run
pnpm init:project --dry-run
```

`pnpm docker:reset -- --confirm` deletes local PostgreSQL and Redis volumes. It is intentionally
guarded and should never be used against a managed environment.

## Design

Features use `controller -> service -> concrete repository -> TypeORM`. See
[`docs/README.md`](docs/README.md) for architecture, API, operations, and governance sources and
[`CONTRIBUTING.md`](CONTRIBUTING.md) for branch, commit, review, and verification rules.
