# Structured Logging

Use injected Nest/Pino loggers and correlation context. Never use `console.*`. Log event names and
structured fields that support operations; do not concatenate unbounded objects into messages.

Redact or omit authorization headers, cookies, passwords, tokens, secret keys, raw personal data,
and database connection strings. Errors sent to clients remain safe; internal errors may be logged
only through the configured redaction policy. Every request log and error response carries the same
validated or generated request ID.
