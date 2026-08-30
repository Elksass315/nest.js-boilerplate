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

Interactive and JSON configuration support selective capability generation. Dependencies are
resolved automatically (for example, `user-avatars` selects `files`), and provenance records both
requested and resolved lists. Structural rendering removes omitted imports, scripts, workers,
Compose services, environment keys, migrations, tests, and documentation sections. Choose
`s3`, `local-development-plus-s3-production`, or
`both-provider-migration` for file storage. Template identities are renamed and
`.company-template.json` records the source version, requested and resolved capabilities,
initialization time, and API/error compatibility.

The initializer runs install, formatting, typecheck, architecture, documentation, unit-test,
build, and Compose configuration checks. Use `--skip-validation` only for controlled generator
tests; a generated project must pass the complete validation workflow before it is adopted.

## Capability validation

`tools/project-capabilities.test.mjs` validates dependency resolution and rejects unknown or cyclic
capabilities. `pnpm profiles:check` generates and structurally checks all 24 resolved profiles;
`pnpm profiles:validate` additionally runs generated-project quality commands.
The generated `.company-template.json` provenance file is machine-owned metadata and is excluded from
Prettier source formatting checks; its schema and capability lists remain covered by generator tests.

**Navigation:** [Previous: Feature Module Architecture](module-architecture.md) | [Documentation Index](../README.md) | [Next: Configuration](configuration.md)
