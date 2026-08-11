# CI/CD Ownership

GitHub Actions owns validation, security analysis, releases, and immutable GHCR image publication.
Jenkins deploys an already-tested image by digest; it never builds or rsyncs source.

Pull-request CI runs frozen install, formatting, lint, strict type checking, architecture/API docs
checks, tests and coverage, dependency policies, Compose/Docker builds, secret scanning, and image
scanning. Main and scheduled workflows add CodeQL, SBOM, license, and deeper scans.

`develop` deploys to development, `release/*` to staging, and `main`/SemVer tags to production after
approval. Jenkins runs one-shot migration and seed jobs from the immutable image, rolls out the API,
waits for readiness, runs smoke tests, and restores the previous digest when rollout validation
fails. Neither the API nor worker entrypoint performs schema or seed mutation.
