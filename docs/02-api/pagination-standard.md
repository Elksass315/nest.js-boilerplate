# Pagination Standard

Business collection endpoints never return raw arrays. Offset pagination is the default:

```text
?page=1&limit=20
```

`page` starts at 1; `limit` defaults to 20 and is capped at 100. Responses contain `items` and meta
with page, limit, totalItems, totalPages, hasNextPage, and hasPreviousPage. Use the canonical query
DTO, result builder, and `ApiOffsetPaginatedResponse` decorator.

Cursor pagination is available only for high-volume, append-oriented, or stable traversal needs.
Its opaque cursor contains a versioned stable sort value and unique entity ID. The repository orders
by both values and fetches one extra row to determine `hasNextPage`. Document the evidence under
`Cursor pagination rationale` in the module document and use `ApiCursorPaginatedResponse`.

Canonical pagination response decorators are the only composed Swagger responses accepted by the
contract checker; they emit the item model and complete page metadata schema without duplicating it
in each controller.

**Navigation:** [Previous: Platform Error Catalog](error-catalog.md) | [Documentation Index](../README.md) | [Next: Branching Strategy](../03-dev-process/branching-strategy.md)
