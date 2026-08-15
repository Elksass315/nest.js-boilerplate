# Commit Standard

Use Conventional Commits:

```text
<type>(<scope>): <imperative description>
```

Allowed types are `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, and
`test`. Use `!` or a `BREAKING CHANGE:` footer for incompatible contracts. Keep commits focused and
include code, tests, Swagger, and authoritative docs together when they form one behavior change.

Feature and fix pull requests squash into `develop`; releases and hotfixes retain merge commits.
Semantic Release generates tags/releases from commits reaching `main` and publishes no npm package.

**Navigation:** [Previous: Branching Strategy](branching-strategy.md) | [Documentation Index](../README.md) | [Next: Pull-Request Review](review-process.md)
