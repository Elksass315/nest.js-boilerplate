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

The current release intentionally supports only the fully wired reference profile. Interactive
initialization selects every optional capability; non-interactive configuration is rejected unless
it does the same. This fail-closed restriction prevents the initializer from producing a project
with orphaned imports, scripts, workers, Compose services, or environment validation. Selective
profiles remain a design target and are not supported until their generated output passes the full
validation workflow. Choose `s3`, `local-development-plus-s3-production`, or
`both-provider-migration` for file storage. Template identities are renamed and
`.company-template.json` records the source version, requested and resolved capabilities,
initialization time, and API/error compatibility.

The initializer runs install, formatting, typecheck, architecture, documentation, unit-test,
build, and Compose configuration checks. Use `--skip-validation` only for controlled generator
tests; a generated project must pass the complete validation workflow before it is adopted.

## Capability validation

`tools/project-capabilities.test.mjs` validates dependency resolution and rejects unknown or cyclic
capabilities. Initializer tests verify that the full profile resolves and that selective generation
fails with an actionable error. A future selective-profile release must add clean-checkout,
non-dry-run generation tests for every supported profile and run the normal validation workflow on
each generated output before the restriction is removed.

**Navigation:** [Previous: Feature Module Architecture](module-architecture.md) | [Documentation Index](../README.md) | [Next: Configuration](configuration.md)
