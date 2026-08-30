# Supported Capability Matrix

The initializer generates every dependency-valid combination of the five optional capabilities.
There are 32 requested subsets and 24 unique resolved profiles because `user-avatars` resolves
the `files` dependency automatically.

| Profile           | Optional capabilities            | Additional runtime dependencies            | Support level           |
| ----------------- | -------------------------------- | ------------------------------------------ | ----------------------- |
| Resolved profiles | All 24 dependency-valid profiles | Profile-specific dependencies and services | Supported and validated |

Every generated project includes the mandatory stack: configuration, structured logging, errors,
i18n, PostgreSQL, Redis, health, Swagger, pagination, authorization, users, authentication,
sessions, security audits, mail, outbox, and the required workers. The manifest is the source of
truth for source paths, migrations, seeds, environment keys, dependencies, and worker processes.

The resolver records that `user-avatars` depends on `files`; selecting avatars alone requests one
capability but resolves both. Avatar routes remain `/users/me/avatar` when selected and preserve their
response and error contracts. File storage supports S3, local-development plus S3 production, and
both-provider migration mode. Production file writes require S3 when the files capability is on.

Local and CI Compose provide PostgreSQL, Redis, Mailpit, and LocalStack. Managed deployments supply
PostgreSQL, Redis, S3, SMTP, secrets, and the OTLP collector externally. No profile changes stable
API paths, error codes, or permission-override behavior.

**Navigation:** [Previous: Architecture Rules](architecture-rules.md) | [Documentation Index](../README.md) | [Next: Operational Ownership](operational-ownership.md)
