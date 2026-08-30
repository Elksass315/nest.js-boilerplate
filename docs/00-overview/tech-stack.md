# Technology Stack

| Area          | Standard                                                      |
| ------------- | ------------------------------------------------------------- |
| Runtime       | Node.js 24.19.0 LTS, pnpm 11.21.0 through Corepack            |
| Framework     | NestJS 11 on Express, strict TypeScript 5.9                   |
| Persistence   | PostgreSQL 18, TypeORM, migration-only schema evolution       |
| Coordination  | Redis 8 and BullMQ 6 for correlated background mail jobs      |
| Security      | Argon2id passwords, two-step/recovery hashes, JOSE sessions   |
| Email         | Nodemailer SMTP worker, BullMQ, Handlebars, local Mailpit     |
| HTTP          | Helmet, CORS allowlist, global validation, URI versioning     |
| Observability | Pino logs, correlation IDs, health endpoints, optional Sentry |
| Contracts     | `@nestjs/swagger` with complete request/response examples     |
| Delivery      | GitHub Actions for CI/images, Jenkins for deployment only     |
| Containers    | One multi-stage Dockerfile and layered Compose definitions    |

Dependencies are exact-pinned and added only for a demonstrated current requirement. See
`package.json` and the lockfile for authoritative versions.

**Navigation:** [Previous: Architecture Overview](architecture.md) | [Documentation Index](../README.md) | [Next: Configuration Standard](../01-backend/configuration.md)
