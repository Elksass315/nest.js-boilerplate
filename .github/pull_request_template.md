## Summary

Describe the outcome and why it is needed.

## Risk and compatibility

- [ ] No public contract change
- [ ] Contract change is documented and backward compatibility is addressed
- [ ] No database change
- [ ] Migration and rollback are documented
- [ ] No security or deployment impact
- [ ] Security/deployment impact is documented

## Verification

- [ ] Work was created on an approved short-lived branch; `main`/`develop` were not edited directly
- [ ] `pnpm validate` passes
- [ ] Integration/e2e tests pass when platform services are affected
- [ ] Docker/Compose configuration is validated when runtime files change
- [ ] New dependencies are necessary, current, licensed, and audited
- [ ] Authoritative documentation is updated in this PR
- [ ] Every changed route documents all request variants and success/error responses with exact examples
