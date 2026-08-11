# Platform Error Catalog

| Status | Code                       | English message                                         | Condition                                                    |
| ------ | -------------------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| 400    | `BAD_REQUEST`              | `The request could not be processed`                    | Malformed JSON, syntax, path, or query encoding.             |
| 401    | `UNAUTHORIZED`             | `Authentication is required`                            | Authentication is absent or invalid.                         |
| 403    | `FORBIDDEN`                | `You are not allowed to perform this action`            | The authenticated principal lacks permission.                |
| 404    | `RESOURCE_NOT_FOUND`       | `The requested resource was not found`                  | No route or requested resource exists.                       |
| 404    | `USER_NOT_FOUND`           | `The requested user was not found`                      | A referenced user identifier does not exist.                 |
| 404    | `ROLE_NOT_FOUND`           | `One or more requested roles were not found`            | A required or requested fixed role does not exist.           |
| 409    | `RESOURCE_CONFLICT`        | `The request conflicts with the current resource state` | A state, uniqueness, foreign-key, or check conflict occurs.  |
| 409    | `EMAIL_ALREADY_REGISTERED` | `An account with this email already exists`             | Registration races or duplicates the normalized email.       |
| 409    | `LAST_SUPER_ADMIN`         | `At least one active super administrator must remain`   | A role/status change would remove the final active owner.    |
| 422    | `VALIDATION_ERROR`         | `Input validation failed`                               | A well-formed DTO fails validation.                          |
| 429    | `TOO_MANY_REQUESTS`        | `Too many requests`                                     | Rate-limit policy rejects the request.                       |
| 503    | `SERVICE_NOT_READY`        | `One or more required services are unavailable`         | PostgreSQL or Redis readiness fails.                         |
| 500    | `INTERNAL_SERVER_ERROR`    | `An unexpected error occurred`                          | An unhandled or unknown persistence failure reaches the API. |

Swagger basic-auth failures occur before the Nest pipeline and return their own documented
`SWAGGER_AUTH_REQUIRED` payload. All API errors contain `requestId` and `correlationId`; clients
should report both when requesting support. Field-level validation messages live under
`details.fields`, never in the stable top-level message. Feature-specific errors are registered,
translated, documented, exemplified in Swagger, and tested before merge. Renaming a published code
or changing its meaning is a breaking API change.
