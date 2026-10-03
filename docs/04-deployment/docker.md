# Docker Workflow

The base Compose file defines the API, mail worker, file worker, outbox worker, maintenance worker, private networks,
application volumes, and health checks. PostgreSQL and Redis are deliberately absent from the base
and deployment layers because managed environments provide them as external services.
`compose.dev.yaml` adds source mounts, hot reload, digest-pinned PostgreSQL, Redis, Mailpit, and
loopback-only local dependency/UI ports. Development also includes digest-pinned LocalStack S3 on
`127.0.0.1:4566`; its ready hook creates the configured private test bucket. Local dependency image
updates are accepted only after their container health checks and integration workflow pass.
The development overlay invokes the built entrypoints directly rather than starting one compiler
watcher per container. This avoids concurrent `dist` cleanup races when the API and workers share
the source mount; run `pnpm build` after source changes before restarting the overlay. Startup grace
periods are longer for the source-mounted development services; deployment health-check timings are
unchanged.
`compose.deploy.yaml` adds the immutable runtime image, read-only filesystems, dropped capabilities,
and one-shot migration and seed jobs. It does not create PostgreSQL, Redis, Mailpit, or LocalStack.

The local and CI service baseline is PostgreSQL `18.6-bookworm` and Redis `8.4.7-alpine`, each
pinned to its multi-platform image digest. The Debian-based Redis 8.x images still ship vulnerable
OpenSSL packages, so the approved image uses Alpine. Compose and CI must retain the same exact references.

```bash
pnpm docker:config
pnpm runtime-images:check
pnpm docker:up
pnpm docker:ps
pnpm docker:logs
pnpm docker:down
```

The API and file worker share `files_data` at `/app/storage/files`; the development image creates
that directory before the volume is initialized so the non-root `node` user can write local-file
health markers and upload data. The container root remains
read-only in deployment. Multiple local-driver replicas require a real shared persistent volume.
S3 is recommended for managed environments.

The production image contains compiled code and production dependencies only, runs as non-root,
and does not run migrations or seeds in its entrypoint. Runtime entrypoints are grouped under
`dist/apps`: `api/main.js`, `mail-worker/main.js`, `file-worker/main.js`,
`outbox-worker/main.js`, and `maintenance-worker/main.js`. Deployment runs the hardened `migrate`
and `seed` one-shot services before
rolling out the API and all four workers from the same image. Every worker writes a short-lived
heartbeat in `/tmp`; Compose health checks fail when a process stops refreshing it.
The file worker imports the shared Redis module so its readiness dependency is available before it
consumes bounded idempotent cleanup jobs and runs the advisory-locked expiry
sweeper; it exposes no port and shuts down gracefully. The mail worker uses
`dist/apps/mail-worker/main.js`, exposes no port, verifies SMTP before consuming jobs, and shuts down
gracefully. Local PostgreSQL, Redis, and Mailpit UI ports bind only to `127.0.0.1`; deployment
definitions expose none of those dependencies. `pnpm docker:reset -- --confirm` is the only supported
destructive local volume reset.

Managed deployment uses `Jenkinsfile`. It requires an immutable image digest and, for production,
the `BACKUP_REFERENCE` recorded by the managed PostgreSQL provider before migrations run. The
deployment record at `.deployment-record` stores the image, source commit, migration compatibility
declaration, backup reference, and UTC completion time. Rollback is attempted only when the previous
image contains the `org.opencontainers.image.migration-compatibility` label; otherwise deployment
fails closed and requires operator review. Jenkins waits for API, mail, file, outbox, and
maintenance worker
health checks, then verifies API readiness, Redis, SMTP, and the configured S3 bucket from inside
the deployment network.
Production dependency installation ignores arbitrary lifecycle scripts and explicitly rebuilds only
the approved native `argon2` and `sharp` packages. CI must build and scan the runtime image so the
Sharp/libvips binary matches the pinned Node 24 Debian runtime.

Redis uses append-only persistence and `noeviction`. BullMQ must never run against an eviction
policy because evicted queue keys can corrupt job state. Capacity alerts and scaling must address
memory pressure before Redis reaches its configured limit; deployment must not switch to an LRU/LFU
policy while queues are enabled.

`pnpm runtime-images:check` enforces the approved major and patch floors, complete digests,
Compose/CI parity, CI scan coverage, and root Docker monitoring by Dependabot. Dependabot proposes
future Docker digest and patch updates from `compose.dev.yaml`; update the matching CI service and
scan references in the same pull request.

**Navigation:** [Previous: Pull-Request Review](../03-dev-process/review-process.md) | [Documentation Index](../README.md) | [Next: CI/CD Ownership](ci-cd.md)
