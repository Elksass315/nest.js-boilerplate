# Sentry observability

The API, mail worker, and file worker entrypoints under `src/apps` initialize the official
`@sentry/nestjs` SDK before importing their Nest modules. Sentry is disabled by default and
configuration fails when enablement and DSN presence disagree. Database-only migration and seed
profiles do not require Sentry settings.

## Configuration

- `SENTRY_ENABLED` controls transmission and defaults to `false`.
- `SENTRY_DSN` is required exactly when enabled and must be an HTTP(S) DSN.
- `SENTRY_ENVIRONMENT` defaults to `NODE_ENV` when empty.
- `SENTRY_RELEASE` should be the immutable image digest, Git commit, or SemVer identifier.
- `SENTRY_TRACES_SAMPLE_RATE` is bounded from zero to one and defaults to zero.
- `SENTRY_DEBUG` defaults to false and should remain false in managed environments.

Do not place auth tokens in Sentry configuration. The DSN is configuration, not an application
credential, but it must still never be written to logs.

## Capture policy and privacy

The global exception filter uses Sentry's official exception-capture decorator. Expected Nest HTTP
exceptions are not reported; unexpected failures and database failures that reach the catch-all
filter are captured. Startup failures from all three processes are captured and flushed for up to
two seconds before a safe process-level message is written.

`sendDefaultPii` is permanently false. Before transmission, request bodies, cookies, query strings,
authorization/cookie headers, user email, username, and IP address are removed. Only request ID,
correlation ID, and user agent survive from request headers. Request and correlation IDs are copied
to searchable event tags. Never attach tokens, passwords, codes, raw personal records, mail bodies,
file contents, storage paths, or database queries as Sentry context.

## Tracing, releases, and source maps

Tracing is opt-in through a bounded sample rate. Start low in production and measure event volume.
The build already emits server source maps and runtime processes use `--enable-source-maps`; source
maps are not uploaded automatically because credentials and project ownership live outside Git.
Deployments should associate the configured immutable release with their Sentry project through
environment-owned release automation.

## Verification

Configuration tests cover disabled defaults, enabled settings, contradictions, and bounds. Privacy
tests verify correlation tags and redaction. A real ingestion smoke test requires an externally
owned DSN and must be performed in a non-production Sentry project after deployment.

Reference: [Official Sentry NestJS SDK setup](https://docs.sentry.io/platforms/javascript/guides/nestjs/).
