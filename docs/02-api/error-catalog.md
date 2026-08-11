# Platform Error Catalog

| Status | Code                    | Message                                                      | Condition                                                         |
| ------ | ----------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| 401    | `SWAGGER_AUTH_REQUIRED` | `Valid credentials are required to access API documentation` | Swagger is in `basic` mode and credentials are absent or invalid. |
| 503    | `SERVICE_NOT_READY`     | `One or more required services are unavailable`              | PostgreSQL or Redis readiness fails.                              |
| 500    | `INTERNAL_SERVER_ERROR` | Safe exception message or `Request failed`                   | An unhandled server failure reaches the global filter.            |

Validation and Nest HTTP failures use their explicit code when supplied; otherwise the filter emits
`HTTP_<status>`. Feature-specific errors are added here or in a linked feature catalog before merge.
Renaming a published code or changing its meaning is a breaking API change.
