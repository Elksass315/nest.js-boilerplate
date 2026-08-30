# Sentry

Sentry is optional error monitoring and tracing for the API, mail worker, and file worker. It is
disabled by default. The migration and seed profiles are database-only and do not require Sentry
configuration.

## Initialization

Each worker and the API initialize the official `@sentry/nestjs` SDK before importing its Nest
modules. Startup failures are captured and flushed for up to two seconds before the process writes
its safe startup error and exits.

The global exception filter uses Sentry's exception-capture integration. Expected Nest HTTP
exceptions are not reported; unexpected failures and database failures reaching the catch-all filter
are captured.

## Configuration

| Variable                    | Default    | Requirements                                                         |
| --------------------------- | ---------- | -------------------------------------------------------------------- |
| `SENTRY_ENABLED`            | `false`    | Must agree with DSN presence.                                        |
| `SENTRY_DSN`                | empty      | Required exactly when monitoring is enabled; must be an HTTP(S) DSN. |
| `SENTRY_ENVIRONMENT`        | `NODE_ENV` | Optional name, maximum 64 characters.                                |
| `SENTRY_RELEASE`            | empty      | Prefer an immutable image digest, Git commit, or SemVer identifier.  |
| `SENTRY_TRACES_SAMPLE_RATE` | `0`        | Number from `0` through `1`; start low in production.                |
| `SENTRY_DEBUG`              | `false`    | Keep disabled in managed environments.                               |

Configuration is validated before dependency connections start. An enabled Sentry configuration
without a DSN, or a disabled configuration with a DSN, fails startup.

Do not put auth tokens in Sentry configuration. The DSN is configuration rather than an application
credential, but it must never be written to logs.

## Privacy and event policy

`sendDefaultPii` is permanently disabled. Before transmission, event processing removes request
bodies, cookies, query strings, authorization and cookie headers, user email, username, and IP
address. Request ID, correlation ID, and user agent are retained from request headers. Request and
correlation IDs are copied to searchable event tags.

Never attach tokens, passwords, one-time codes, raw personal records, mail bodies, file contents,
storage paths, or database queries as Sentry context.

## Releases, tracing, and source maps

Tracing is opt-in through the bounded sample rate. Monitor event volume and lower the production
rate when necessary. The build emits server source maps and runtime processes use
`--enable-source-maps`; source maps are not uploaded automatically because credentials and project
ownership belong to deployment automation.

Deployments should associate the configured immutable release with the corresponding Sentry
project through environment-owned release automation.

## Verification

Configuration tests cover disabled defaults, enabled settings, contradictory DSN settings, and
sample-rate bounds. Privacy tests cover correlation tags and sensitive-field redaction. A real
ingestion smoke test requires an externally owned DSN and must run against a non-production Sentry
project after deployment.

Reference: [Official Sentry NestJS SDK setup](https://docs.sentry.io/platforms/javascript/guides/nestjs/).

**Navigation:** [Previous: Structured Logging](logging.md) | [Documentation Index](../README.md) | [Next: Database and Migrations](database.md)
