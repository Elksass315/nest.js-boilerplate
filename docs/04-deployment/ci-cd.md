# CI/CD Ownership

GitHub Actions owns validation, security analysis, releases, and immutable GHCR image publication.
Jenkins deploys an already-tested image by digest; it never builds or rsyncs source.

Pull-request CI runs frozen install, formatting, lint, strict type checking, architecture/API docs
checks, tests and coverage, dependency policies, Compose/Docker builds, secret scanning, and image
scanning. The container job scans the application image and checks the PostgreSQL and Redis
operating-system packages for fixed high and critical vulnerabilities. Integration setup applies
migrations and immutable seeds before E2E so fixed reference data,
including RBAC roles and permissions, matches a real deployment. Main and scheduled workflows add
CodeQL, SBOM, license, and deeper scans. File-storage integration runs against local storage and a
digest-pinned LocalStack S3 service before deployment. CI creates a private bucket explicitly and
uses path-style S3 access with synthetic credentials.

The quality job also supplies the required `AUTH_ACCESS_TOKEN_SECRET` as a test-only fixture so
OpenAPI generation can bootstrap the Nest application. It must never be copied into staging or
production configuration. Coverage artifacts are uploaded as a best-effort diagnostic; a failed
test/build step remains the primary CI failure and does not create a misleading second failure when
no coverage directory exists.

The quality job generates and lints the OpenAPI document against the executable route metadata before
running tests. Jest uses the exact-pinned SWC transformer; `tsc` remains the authoritative typecheck.
After coverage, `coverage:changed` compares executable changed lines with the PR base and requires at
least 80% changed-line coverage in addition to the 80% global coverage floor. The CI checkout keeps
full history so the base SHA is available to this comparison.
Coverage collection excludes DTOs, entities, module wiring, migration files, and process entrypoints;
the gate is intended to measure executable application behavior.

The secret-scan job examines full Git history with Gitleaks. Confirmed false positives are ignored
only by their exact finding fingerprint in `.gitleaksignore`; broad path, rule, commit, or regular
expression exclusions are forbidden. The workflow passes the ignore file explicitly so container
working-directory changes cannot silently disable the reviewed exceptions. Squash and release
merges can produce new commit-specific fingerprints for the same reviewed example; each new
fingerprint must be verified and added explicitly rather than weakening the scan rule.

Every service-container upgrade must pass its configured readiness command in CI before it is
accepted. If a pinned upgrade cannot become healthy, restore the last verified version and digest
while the incompatibility is investigated separately.

The runtime-image contract gate requires exact patch tags and full digests, keeps Compose service
images synchronized with both CI service and scan references, and verifies that Dependabot monitors
root Docker manifests. PostgreSQL and Redis updates therefore include readiness, migrations, seeds,
E2E coverage, and image scanning in one reviewable change.

The Redis image scan has no vulnerability exceptions. The Debian-based Redis 8.x images currently
ship OpenSSL packages with unfixed HIGH advisories, so the baseline uses the Alpine variant, which
scans clean. Do not add `.trivyignore` files; update the image instead.

`develop` deploys to development, `release/*` to staging, and `main`/SemVer tags to production after
approval. Jenkins requires a production `BACKUP_REFERENCE` before running migrations, records it in
the deployment output, and runs one-shot migration and seed jobs from the immutable image. It then
rolls out the API, mail worker, file worker, outbox worker, and maintenance worker, waits for every
heartbeat health check, and runs API, Redis, SMTP, and S3 smoke tests. A failed rollout restores all processes to the
previous digest only when that image declares migration compatibility; undeclared rollback targets
fail closed. The image includes `deployment/migration-compatibility.json`, whose expand/contract
policy requires additive schema changes before application rollout and delayed destructive changes
until all previous images are retired. Neither the API nor worker entrypoint performs schema or seed
mutation.

**Navigation:** [Previous: Docker Workflow](docker.md) | [Documentation Index](../README.md) | [Next: Documentation Policy](../governance/documentation-policy.md)

Scheduled CI shards the 24 resolved capability profiles. Pull requests run structural generation
checks, while service-backed validation remains focused on minimal, files-plus-avatars, and full
profiles to keep feedback fast and representative.
