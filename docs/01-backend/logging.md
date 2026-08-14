# Structured Logging

Use injected Nest/Pino loggers and request context. Never use `console.*`. Log event names and
structured fields that support operations; do not concatenate unbounded objects into messages.

Redact or omit authorization headers, cookies, passwords, tokens, secret keys, raw personal data,
and database connection strings. Errors sent to clients remain safe; internal errors may be logged
only through the configured redaction policy.

Every HTTP request has two identifiers:

- `x-request-id` identifies one API hop. A safe caller value is preserved; otherwise the API creates
  a UUID.
- `x-correlation-id` connects a workflow across API calls, queues, workers, and downstream services.
  A safe caller value is preserved; otherwise it defaults to the request ID.

Both values are returned as response headers, placed on the Express request, stored in asynchronous
request context, included in structured request logs, and emitted in every error response. Allowed
caller values contain only letters, numbers, `.`, `_`, `:`, or `-` and are at most 128 characters;
unsafe values are replaced. Future queue producers copy the correlation ID into job metadata and
workers restore it before logging or calling downstream systems.
