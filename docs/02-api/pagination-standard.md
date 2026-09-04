# Pagination Standard

Business collection endpoints never return raw arrays. Offset pagination is the default:

```text
?page=1&limit=20
```

`page` starts at 1; `limit` defaults to 20 and is capped at 100. Responses contain `items` and meta
with page, limit, totalItems, totalPages, hasNextPage, and hasPreviousPage. Use the canonical query
DTO, result builder, and `ApiOffsetPaginatedResponse` decorator.

At the HTTP boundary, the page is returned under the standard success envelope's `data` property;
the request/correlation metadata remains in the envelope `meta` property. Thus a page response has
the shape `{ success: true, meta: { requestId, correlationId, timestamp }, data: { items, meta } }`.

The generated OpenAPI contract requires every collection response to include a deterministic page
example. Controllers pass the example to the canonical decorator; the CI OpenAPI linter checks that
the example remains present alongside the complete pagination metadata.

Cursor pagination is available only for high-volume, append-oriented, or stable traversal needs.
Its opaque cursor contains a versioned stable sort value and unique entity ID. The repository orders
by both values and fetches one extra row to determine `hasNextPage`. Document the evidence under
`Cursor pagination rationale` in the module document and use `ApiCursorPaginatedResponse`.

Canonical pagination response decorators are the only composed Swagger responses accepted by the
contract checker; they emit the item model and complete page metadata schema without duplicating it
in each controller. Feature controllers supply a deterministic synthetic page example through the
decorator's optional example argument; examples must match the DTO and page metadata contract and
must not contain real user or credential data. The same route-contract gate requires every
collection route, like every other route, to declare `Public`, `RequireAuthenticated`, or
`RequirePermissions` explicitly.

**Navigation:** [Previous: Platform Error Catalog](error-catalog.md) | [Documentation Index](../README.md) | [Next: Branching Strategy](../03-dev-process/branching-strategy.md)
