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

The Redis scan has one narrow exception in `.trivyignore.redis` for `CVE-2026-14456`. The advisory
affects OpenSSL QUIC server behavior, which Redis does not expose or use. The exception expires on
2026-09-30, is applied only to the Redis image scan, and must be removed as soon as the official
Redis 8.4 image contains fixed OpenSSL packages. The runtime-image contract rejects additional
exceptions and fails after the expiry date.

`develop` deploys to development, `release/*` to staging, and `main`/SemVer tags to production after
approval. Jenkins runs one-shot migration and seed jobs from the immutable image, rolls out the API,
mail worker, and file worker, waits for readiness, runs API and SMTP smoke tests, and restores all
processes to the previous digest when rollout validation fails. Neither the API nor worker entrypoint performs
schema or seed mutation.

**Navigation:** [Previous: Docker Workflow](docker.md) | [Documentation Index](../README.md) | [Next: Documentation Policy](../governance/documentation-policy.md)
