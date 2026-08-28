# Supported Capability Matrix

The initializer generates a single-tenant REST v1 application from the mandatory platform and
the optional capabilities below. Profiles are supported combinations, not separate products.

| Profile           | Optional capabilities     | Additional runtime dependencies                             | Support level                 |
| ----------------- | ------------------------- | ----------------------------------------------------------- | ----------------------------- |
| Minimal           | None                      | Managed PostgreSQL, Redis, SMTP, OTLP collector             | Supported baseline            |
| Files and avatars | `files`, `user-avatars`   | S3 in production; local storage may be used for development | Supported                     |
| Invitations       | `team-invitations`        | SMTP (already mandatory)                                    | Supported                     |
| Feature flags     | `feature-flags`           | None                                                        | Supported                     |
| Sentry            | `sentry`                  | Sentry DSN and outbound network access                      | Supported, optional reporting |
| Full              | All optional capabilities | S3, SMTP, Sentry as configured                              | Supported reference profile   |

Every generated project includes the mandatory stack: configuration, structured logging, errors,
i18n, PostgreSQL, Redis, health, Swagger, pagination, authorization, users, authentication,
sessions, security audits, mail, outbox, and the required workers. The manifest is the source of
truth for source paths, migrations, seeds, environment keys, dependencies, and worker processes.

Selecting `user-avatars` automatically selects `files`; the initializer refuses an invalid
dependency graph. Avatar routes remain `/users/me/avatar` in the full template and preserve their
response and error contracts. File storage supports S3, local-development plus S3 production, and
both-provider migration mode. Production file writes require S3 when the files capability is on.

Local and CI Compose provide PostgreSQL, Redis, Mailpit, and LocalStack. Managed deployments supply
PostgreSQL, Redis, S3, SMTP, secrets, and the OTLP collector externally. No profile changes stable
API paths, error codes, or permission-override behavior.

**Navigation:** [Previous: Architecture Rules](architecture-rules.md) | [Documentation Index](../README.md) | [Next: Operational Ownership](operational-ownership.md)
