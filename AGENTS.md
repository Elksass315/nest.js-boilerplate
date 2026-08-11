# Repository Working Agreement

This repository is a single-tenant NestJS modular monolith. Read `README.md`,
`docs/architecture.md`, and `CONTRIBUTING.md` before changing behavior or structure. Rules in a
closer `AGENTS.md` add to these repository-wide rules.

## Mandatory Engineering Rules

- Use Node 24.19.0 and pnpm 11.21.0 through Corepack. Do not create another lockfile.
- Keep TypeScript strict. Never use `any`, unsafe casts to silence errors, or ignored promises.
- Keep changes focused. Do not add dependencies, layers, abstractions, or shared utilities without
  a concrete current use.
- Validate every external input. Never return TypeORM entities as API contracts.
- Use `ConfigService`; never hardcode credentials, environment-specific hosts, or secrets.
- Use structured logging with correlation context. Never use `console.*` or log secrets, tokens,
  cookies, passwords, or raw personal data.
- Use migrations for schema changes. Never enable TypeORM synchronization.
- Do not run migrations or seeds from the API startup path.
- Update tests and authoritative documentation when behavior, contracts, security, deployment, or
  architecture changes.
- Do not claim completion until the relevant checks pass. Run `pnpm validate` for repository
  changes; also run e2e and Docker validation when platform wiring changes.

## Dependency Policy

- Prefer the platform and existing dependencies before adding a package.
- Add exact versions only; let pnpm update `pnpm-lock.yaml`.
- Verify maintenance status, license, transitive footprint, Node compatibility, and advisories.
- Do not introduce packages for auth, queues, mail, storage, media, or WebSockets before their
  feature phase.

## Code Review Rules

- Flag controller business logic, controller-to-repository calls, direct cross-feature persistence
  access, entity responses, missing DTO validation, swallowed errors, and missing failure tests.
- Flag secrets, permissive production defaults, unbounded retries, automatic startup migrations,
  mutable deployment image tags, and logs containing sensitive fields.
- Flag DDD-style domain/application/infrastructure folders or repository interface/adapter pairs
  unless an approved ADR demonstrates a current need.
- Treat generated code as untrusted and verify it against the same rules and commands.
