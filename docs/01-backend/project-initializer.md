# Capability manifest and project initializer

`capabilities.manifest.json` describes each capability's dependencies, source paths, migrations,
seeds, configuration, environment keys, workers, Compose services, documentation, and package
dependencies. Keep this manifest in the same change as a capability so generated projects do not
drift from the template.

## Initializing a project

Run the interactive initializer from an untouched template:

```bash
pnpm init:project
```

The command requires `.company-template-source.json`, a clean worktree, and no existing
`.company-template.json`. If invoked on `main` or `develop`, it creates or switches to
`chore/initialize-project` before changing files. Use `--config path/to/config.json` for a
non-interactive run and `--dry-run` to resolve capabilities without writing.

`user-avatars` automatically selects `files`. When files are selected, choose `s3`,
`local-development-plus-s3-production`, or `both-provider-migration`. Unselected capability paths
and package dependencies are removed only when they are not shared with a selected or mandatory
capability. Template identities are renamed and `.company-template.json` records the source
version, requested and resolved capabilities, initialization time, and API/error compatibility.

The initializer runs install, formatting, typecheck, architecture, documentation, unit-test,
build, and Compose configuration checks. Use `--skip-validation` only for controlled generator
tests; a generated project must pass the complete validation workflow before it is adopted.

## Capability test matrix

`tools/project-capabilities.test.mjs` validates dependency resolution and rejects unknown or cyclic
capabilities. CI should build representative minimal, files/avatar, invitations, feature-flags,
Sentry, and full combinations on every pull request. A nightly job should generate every valid
combination and verify that avatars without files resolve files automatically.

**Navigation:** [Previous: Feature Module Architecture](module-architecture.md) | [Documentation Index](../README.md) | [Next: Configuration](configuration.md)
