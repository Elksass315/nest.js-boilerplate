# CI/CD Ownership

GitHub Actions owns validation, security analysis, releases, and immutable GHCR image publication.
Jenkins deploys an already-tested image by digest; it never builds or rsyncs source.

Pull-request CI runs frozen install, formatting, lint, strict type checking, architecture/API docs
checks, tests and coverage, dependency policies, Compose/Docker builds, secret scanning, and image
scanning. Main and scheduled workflows add CodeQL, SBOM, license, and deeper scans.

The secret-scan job examines full Git history with Gitleaks. Confirmed false positives are ignored
only by their exact finding fingerprint in `.gitleaksignore`; broad path, rule, commit, or regular
expression exclusions are forbidden. The workflow passes the ignore file explicitly so container
working-directory changes cannot silently disable the reviewed exceptions.

`develop` deploys to development, `release/*` to staging, and `main`/SemVer tags to production after
approval. Jenkins runs one-shot migration and seed jobs from the immutable image, rolls out the API
and mail worker, waits for readiness, runs API and SMTP smoke tests, and restores both processes to
the previous digest when rollout validation fails. Neither the API nor worker entrypoint performs
schema or seed mutation.
