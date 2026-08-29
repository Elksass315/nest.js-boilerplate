# Supported Capability Matrix

The initializer currently generates the fully wired single-tenant REST v1 reference application.
The manifest still records capability boundaries and dependencies, but selective generation is
disabled until each profile has executable generated-project validation.

| Profile           | Optional capabilities     | Additional runtime dependencies                             | Support level                |
| ----------------- | ------------------------- | ----------------------------------------------------------- | ---------------------------- |
| Minimal           | None                      | Managed PostgreSQL, Redis, SMTP, OTLP collector             | Planned; generation rejected |
| Files and avatars | `files`, `user-avatars`   | S3 in production; local storage may be used for development | Planned; generation rejected |
| Invitations       | `invitations`             | SMTP (already mandatory)                                    | Planned; generation rejected |
| Feature flags     | `feature-flags`           | None                                                        | Planned; generation rejected |
| Sentry            | `sentry`                  | Sentry DSN and outbound network access                      | Planned; generation rejected |
| Full              | All optional capabilities | S3, SMTP, Sentry as configured                              | Supported reference profile  |

Every generated project includes the mandatory stack: configuration, structured logging, errors,
i18n, PostgreSQL, Redis, health, Swagger, pagination, authorization, users, authentication,
sessions, security audits, mail, outbox, and the required workers. The manifest is the source of
truth for source paths, migrations, seeds, environment keys, dependencies, and worker processes.

The resolver records that `user-avatars` depends on `files`, while the initializer currently
requires every optional capability. Avatar routes remain `/users/me/avatar` in the full template and preserve their
response and error contracts. File storage supports S3, local-development plus S3 production, and
both-provider migration mode. Production file writes require S3 when the files capability is on.

Local and CI Compose provide PostgreSQL, Redis, Mailpit, and LocalStack. Managed deployments supply
PostgreSQL, Redis, S3, SMTP, secrets, and the OTLP collector externally. No profile changes stable
API paths, error codes, or permission-override behavior.

**Navigation:** [Previous: Architecture Rules](architecture-rules.md) | [Documentation Index](../README.md) | [Next: Operational Ownership](operational-ownership.md)
