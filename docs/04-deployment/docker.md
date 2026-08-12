# Docker Workflow

The base Compose file defines API, mail worker, PostgreSQL, Redis, private networks, volumes, and
health checks. `compose.dev.yaml` adds source mounts, hot reload, digest-pinned Mailpit, and
loopback-only local dependency/UI ports.
`compose.deploy.yaml` adds the immutable runtime image, read-only filesystems, dropped capabilities,
and one-shot migration and seed jobs.

```bash
pnpm docker:config
pnpm docker:up
pnpm docker:ps
pnpm docker:logs
pnpm docker:down
```

The production image contains compiled code and production dependencies only, runs as non-root,
and does not run migrations or seeds in its entrypoint. Deployment runs the hardened `migrate` and
`seed` one-shot services before rolling out the API and mail worker from the same image. The worker
uses `dist/mail-worker.js`, exposes no port, verifies SMTP before consuming jobs, and shuts down
gracefully. Local PostgreSQL, Redis, and Mailpit UI ports bind only to `127.0.0.1`; deployment
definitions expose none of those dependencies. `pnpm docker:reset -- --confirm` is the only supported
destructive local volume reset.

Redis uses append-only persistence and `noeviction`. BullMQ must never run against an eviction
policy because evicted queue keys can corrupt job state. Capacity alerts and scaling must address
memory pressure before Redis reaches its configured limit; deployment must not switch to an LRU/LFU
policy while queues are enabled.
