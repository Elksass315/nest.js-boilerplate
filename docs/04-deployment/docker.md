# Docker Workflow

The base Compose file defines API, PostgreSQL, Redis, private networks, volumes, and health checks.
`compose.dev.yaml` adds source mounts, hot reload, and local ports. `compose.deploy.yaml` adds the
immutable runtime image, read-only filesystems, dropped capabilities, and migration job.

```bash
pnpm docker:config
pnpm docker:up
pnpm docker:ps
pnpm docker:logs
pnpm docker:down
```

The production image contains compiled code and production dependencies only, runs as non-root,
and does not run migrations or seeds in its entrypoint. `pnpm docker:reset -- --confirm` is the only
supported destructive local volume reset.
