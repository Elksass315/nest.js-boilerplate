# Pull-Request Review

Reviewers verify architecture boundaries, controller/service/repository ownership, validation,
error safety, logging/redaction, migrations, dependency necessity, tests, and documentation parity.

For every API route, reviewers compare implementation, DTOs, tests, Swagger, and module docs:

- explicit controller version;
- all reachable success and error statuses;
- exact stable error codes and client-visible messages;
- concrete response examples;
- named examples for each meaningfully different accepted request body.

Missing or stale documentation blocks merge. Exceptions require an owner, rationale, expiring due
date, and tracked remediation—not an unchecked promise to update later.
