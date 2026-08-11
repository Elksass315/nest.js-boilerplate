# Pull-Request Review

Reviewers verify architecture boundaries, controller/service/repository ownership, validation,
error safety, logging/redaction, migrations, dependency necessity, tests, and documentation parity.

For every API route, reviewers compare implementation, DTOs, tests, Swagger, and module docs:

- explicit controller version;
- all reachable success and error statuses;
- exact stable error codes and client-visible messages;
- concrete response examples;
- named examples for each meaningfully different accepted request body.

Use `pnpm validate:change` after each coding prompt. Formatting, strict lint, type checking,
applicable focused tests, and build are mandatory blocking gates. The command derives additional
checks from the current Git diff and rejects governed code, configuration, API, agent, database,
container, and delivery changes when their authoritative documentation is absent from the same diff.
Run full `pnpm validate` before requesting review or cutting a release, and for broad or high-risk
changes. Diff selection never removes relevant external e2e, migration, seed, worker, SMTP, or Docker
verification.

Missing or stale documentation blocks merge. Exceptions require an owner, rationale, expiring due
date, and tracked remediation—not an unchecked promise to update later.
