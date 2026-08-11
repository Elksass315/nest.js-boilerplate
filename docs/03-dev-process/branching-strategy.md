# Branching Strategy

- `main` is production only; `develop` integrates the next release. Agents never write directly to
  either branch.
- `feature/*`, `fix/*`, `refactor/*`, and `chore/*` branch from an up-to-date `develop` and squash
  back through reviewed pull requests.
- `release/<semver>` branches (for example `release/0.1.0`) from `develop`; `hotfix/*` branches from
  `main`. Both require explicit release authorization and merge commits/back-merges for traceability.

Before any repository write, run:

```bash
git status --short --branch
pnpm branch:write-check
```

Do not bypass hooks or move already-created edits off a protected branch as a normal workflow.
Preserve unrelated user changes and correct the branch without destructive Git commands.
