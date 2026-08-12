# Configuration Standard

Copy `.env.example` for development. Managed environments inject secrets outside Git.

Configuration is namespaced and typed by domain: app, CORS, logging, Swagger, rate limits, i18n,
database, Redis, auth, and mail. Each domain owns its schema fragment, loader, contract, tests, and
environment documentation. One composed validator creates the API configuration.

Executables validate only their dependencies:

- API validates every platform domain.
- Migration commands validate database settings only.
- Seed commands validate database and seed settings.
- Mail workers validate app identity, logging, Redis, database, and mail settings only.

Raw `process.env` access is restricted to configuration and CLI entrypoints. Application code uses
typed `ConfigService` paths such as `app.port`, `auth.accessTokenTtlSeconds`, and `mail.branding`.
Missing, malformed, insecure, or contradictory values fail before dependency connections.

`AUTH_ACCESS_TOKEN_SECRET` is mandatory and contains at least 32 characters. Access tokens default
to 15 minutes; absolute session lifetime defaults to 14 days. Verification tokens default to one
day, reset tokens to 30 minutes, active sessions to five, and password lockout to five failed
attempts for 15 minutes.

Two-step email codes default to five minutes and five attempts. Enrollment creates ten single-use
recovery codes by default. `AUTH_TWO_STEP_CODE_TTL_SECONDS`, `AUTH_TWO_STEP_MAX_ATTEMPTS`, and
`AUTH_RECOVERY_CODE_COUNT` are bounded and fail validation when unsafe.

Mail configuration owns sender, public action URL, SMTP connection timeouts, worker concurrency,
retry policy, and branding. `MAIL_ENABLED=false` safely suppresses queue production and worker SMTP
startup. When enabled, auth queues named HBS templates with correlation context; no SMTP password,
token, code, body, or full recipient is logged.

When configuration changes, update schema, tests, `.env.example`, Compose/CI/deployment inputs, and
this document together. Swagger modes remain `public`, `basic`, and `disabled`; managed environments
reject public access.
