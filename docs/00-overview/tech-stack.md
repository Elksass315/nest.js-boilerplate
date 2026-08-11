# Technology Stack

| Area          | Standard                                                   |
| ------------- | ---------------------------------------------------------- |
| Runtime       | Node.js 24.19.0 LTS, pnpm 11.21.0 through Corepack         |
| Framework     | NestJS 11 on Express, strict TypeScript 5.9                |
| Persistence   | PostgreSQL 18, TypeORM, migration-only schema evolution    |
| Coordination  | Redis 8; queues are deferred                               |
| HTTP          | Helmet, CORS allowlist, global validation, URI versioning  |
| Observability | Pino structured logs, correlation IDs, health endpoints    |
| Contracts     | `@nestjs/swagger` with complete request/response examples  |
| Delivery      | GitHub Actions for CI/images, Jenkins for deployment only  |
| Containers    | One multi-stage Dockerfile and layered Compose definitions |

Dependencies are exact-pinned and added only for a demonstrated current requirement. See
`package.json` and the lockfile for authoritative versions.
