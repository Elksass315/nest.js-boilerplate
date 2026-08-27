# Files Module

## Purpose and scope

`files` owns resumable byte transfer, metadata persistence, local/S3 provider selection, stable
public access, cleanup, and online provider migration. It does not expose a generic upload route.
Each business feature owns and authenticates its upload endpoints and passes a fixed server-side
purpose, size, and declared-MIME policy to `FilesService`.

## Structure and public surface

The flat module contains one controller for public reads, `FilesService` workflows, a concrete
TypeORM repository, the `stored_files` entity, local/S3 providers, and their small factory. The
provider contract is justified by two immediate implementations. The public index exports only the
module, service, migration service, and intentional migration contracts. Other features never
import providers, stores, repositories, or entities.

The latest tus line is native ESM while the Nest application compiles to CommonJS. A small copied
CommonJS loader uses native dynamic import at runtime; this isolates module-system compatibility
without converting the application. The E2E script starts Jest with Node's VM-module support so
the same native tus runtime is exercised rather than mocked.

## API contracts

| Method | Route                     | Policy    | Success    | Reachable errors                               |
| ------ | ------------------------- | --------- | ---------- | ---------------------------------------------- |
| GET    | `/files/public/:publicId` | anonymous | 200 or 302 | 400, 404 `FILE_NOT_FOUND`, 503 storage failure |

The public-file route serves only `ready + public` records. It streams local bytes with immutable
safe headers or redirects to a short-lived signed S3 URL. Protected, unfinished, and unknown records
all return `404 FILE_NOT_FOUND`; provider failures return `503 FILE_STORAGE_UNAVAILABLE`.

Every public file descriptor returned by the service uses an absolute URL built from `APP_BASE_URL`,
for example `https://api.example.com/api/v1/files/public/<public-id>`. This applies consistently to
avatars and any future public file consumer; protected files are never included in these descriptors.

`FilesService.handleTus` supports creation, HEAD offset discovery, sequential PATCH continuation,
expiration, and termination. Deferred length, concatenation, and parallel uploads are disabled.
OPTIONS may advertise protocol capabilities anonymously. Every stateful consumer route must pass
an authenticated uploader and correlation context; ownership and purpose are rechecked for an
existing upload. Global CORS passes feature-owned upload capability requests through to the tus
handler while continuing to answer ordinary preflight requests itself. Upload completion records
SHA-256 before the file may be claimed.

The public service also exposes bounded owned-upload reads, processed-byte staging, transactional
claim/deletion operations, and batched public descriptors. Consumers never receive a provider
instance. Processed content is written to a deterministic server-generated `ready/<file-id>` key
before a transaction. This lets expired-upload cleanup recover a processed object left behind by
an interruption before the database claim. The key remains immutable after a successful claim
locks and switches the file row. The previous raw provider/key remains in pending-cleanup fields so
the worker can remove it after commit and recover a failed enqueue through the sweeper.

## Data and migrations

`stored_files` records provider/key, random public ID, original name, media type, size, SHA-256,
protected/public visibility, lifecycle status, purpose, uploader, expiry/claim/delete timestamps,
safe failure code, and request/correlation IDs. Provider and storage key remain per row so local and
S3 reads coexist. Migration `1786838400000` creates the table, constraints, indexes, and uploader
foreign key without importing the user entity.

Provider moves are explicit and never run at startup:

```bash
pnpm files:migration:status
pnpm files:migrate -- --from local --to s3 --dry-run
pnpm files:migrate -- --from local --to s3 --confirm
```

Migration takes a PostgreSQL advisory lock, scans bounded ready-file batches, verifies size and
SHA-256, switches provider metadata atomically, and deletes the source afterward. A failed source
delete remains durably recorded for worker recovery. Target mismatches are never overwritten.

## Security and observability

Files default to protected, storage keys are generated server-side, local paths reject traversal,
and the local root is never statically served. The S3 bucket remains private. Bucket-default
encryption must be configured for tus multipart uploads; direct provider writes also request the
configured SSE mode. Configure an S3 lifecycle rule to abort incomplete multipart uploads after one
day as defense in depth, while the worker terminates known abandoned tus uploads.

The file worker uses bounded exponential retries, idempotent delete jobs, a 15-minute sweeper, and a
PostgreSQL advisory lock. Logs contain file IDs, providers, safe error types, request IDs, and
correlation IDs—never filenames, paths, object bodies, tokens, or personal data.

Example lifecycle rule:

```json
{
  "Rules": [
    {
      "ID": "abort-incomplete-tus-uploads",
      "Status": "Enabled",
      "Filter": { "Prefix": "" },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
    }
  ]
}
```

## Test strategy and change impact

Unit tests cover configuration contradictions, provider selection, local traversal, reads/writes,
checksums, cleanup retries, migration confirmation/dry run/copy verification, public access, and
storage readiness. Avatar-consumer tests additionally cover bounded reads, immutable staging,
transactional claims, cleanup recovery, and public descriptor mapping. Integration and E2E suites
exercise PostgreSQL, Redis/BullMQ, local storage, and
S3-compatible multipart behavior. Rollback drops only `stored_files`; physical object retention
must be handled operationally before reversing the migration.

## Cursor pagination rationale

Not applicable. The module exposes no business collection endpoint.

**Navigation:** [Previous: Authorization Module](authorization.md) | [Documentation Index](../../README.md) | [Next: Mail Module](mail.md)
