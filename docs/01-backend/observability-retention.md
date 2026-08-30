# Observability and Operational Retention

Every API and worker process loads `src/instrument.ts` before Nest. When `OTEL_ENABLED=true`,
the NodeSDK exports traces and metrics over OTLP protobuf to `OTEL_EXPORTER_OTLP_ENDPOINT`.
HTTP, PostgreSQL, Redis, Express, and Undici are auto-instrumented; outbox publication and SMTP
delivery add explicit spans. OpenTelemetry logs are intentionally disabled. Pino remains the only
application log source and continues to redact credentials, tokens, request bodies, and personal data.

Metrics use bounded labels only: route templates, queue names, worker names, status, and stable
operation categories. User IDs, email addresses, SQL text, payloads, object keys, and correlation
IDs are never metric attributes. The baseline signals are request count and latency, throttling,
queue lag, outbox status, mail failures, file cleanup volume, and worker heartbeat.

The maintenance worker runs bounded, idempotent cleanup on a configurable interval. Authentication
token and session cutoffs are applied independently. It acquires
the PostgreSQL `maintenance:retention` advisory transaction lock, so multiple replicas do not
run the same sweep concurrently. Use `pnpm maintenance:run -- --dry-run` for a non-mutating
configuration check; dry run does not currently count deletion candidates.

Retention applies only to expired or consumed authentication tokens, expired or revoked sessions,
sent/failed mail deliveries, published/terminal-failed outbox rows, and unclaimed expired failed
temporary file metadata. Pending mail, active sessions, pending/processing outbox rows, ready files, security
audits, feature-flag audits, and business records are never removed automatically.

Operators should alert on API error rate/latency, queue lag, outbox age/failure growth, mail failure
rate, cleanup failures, and missing worker heartbeats. Group dashboards by service, route template,
queue, topic, and worker—not by users or request identifiers.

**Navigation:** [Previous: Logging](logging.md) | [Documentation Index](../README.md) | [Next: Database, Migration, and Seed Standard](database.md)
