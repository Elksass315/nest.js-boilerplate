# User Avatars Module

## Purpose and scope

`user-avatars` is an optional capability that owns avatar image validation, sanitization, and the
user-to-file association boundary. It depends on the optional `files` capability and never accesses
storage providers, tus stores, or file repositories directly.

## Structure and public surface

The module exports `UserAvatarsService`, `AvatarImageService`, and the existing
`UserAvatarUploadsController` through `index.ts`. The users module keeps compatibility re-exports,
so `/api/v1/users/me/avatar/uploads` and `/api/v1/users/me/avatar` retain their v1 route and
response contracts in the full template. The association entity and repository are private.

`UserAvatarsService` exposes transaction-aware attach, remove, and lookup methods. Generated
projects consume those methods from an owning user/profile service without importing TypeORM
entities or repositories.

## API contracts

The full template preserves the existing upload routes while the controller is owned by this
capability. Capability discovery is explicitly public; every stateful route declares
`RequireAuthenticated`, which installs the authorization guard:

| Method  | Route                                | Policy                      | Success | Reachable errors                       |
| ------- | ------------------------------------ | --------------------------- | ------- | -------------------------------------- |
| OPTIONS | `/users/me/avatar/uploads`           | public capability discovery | 204     | 503                                    |
| POST    | `/users/me/avatar/uploads`           | authenticated owner         | 201     | 400, 401, 412, 413, 415, 503           |
| HEAD    | `/users/me/avatar/uploads/:uploadId` | authenticated owner         | 200     | 400, 401, 403, 404, 410, 412, 503      |
| PATCH   | `/users/me/avatar/uploads/:uploadId` | authenticated owner         | 204     | 400, 401, 403, 404, 409, 410, 412, 503 |
| DELETE  | `/users/me/avatar/uploads/:uploadId` | authenticated owner         | 204     | 400, 401, 403, 404, 410, 412, 503      |
| PATCH   | `/users/me/avatar`                   | authenticated owner         | 200     | 401, 404, 409, 413, 415, 422, 503      |
| DELETE  | `/users/me/avatar`                   | authenticated owner         | 204     | 401, 404, 503                          |

## Data and migration

Migration `1787702400000-CreateUserAvatarAssociations` creates unique user and file references and
backfills the legacy `users.avatar_file_id` column. Migration
`1787800000000-DropLegacyUserAvatarColumn` removes that column after the compatibility backfill.

## Security and test strategy

Avatar uploads remain authenticated, protected by default, purpose-bound, and limited to JPEG, PNG,
and WebP. Declared MIME, filename extension, and decoded format must agree; animation, excessive
dimensions, and excessive decoded pixels are rejected. Sanitization re-encodes without metadata.
Unit tests cover dependency resolution, public-boundary imports, association uniqueness, and the
existing upload controller contract. Migration tests cover backfill, foreign keys, and rollback.

**Navigation:** [Previous: Users Module](users.md) | [Documentation Index](../../README.md) | [Next: File Storage Module](files.md)

`user-avatars` owns attachment/removal routes and response enrichment. Selecting it automatically
resolves `files`; without it, user responses and OpenAPI schemas contain no `avatar` property.
