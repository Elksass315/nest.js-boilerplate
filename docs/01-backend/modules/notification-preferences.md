# Notification preferences module

## Purpose and scope

This module owns authenticated, per-user preferences for optional email categories. The initial
template supports `product_updates` and `marketing`, both disabled by default. Account-protection,
verification, password, session, two-step, role, and status emails remain mandatory and are exposed
as read-only `securityEmail: true`; users cannot suppress them.

The module intentionally does not advertise unsupported push, SMS, in-app, digest, scheduling, or
quiet-hours behavior. A later project may add a channel only with a real delivery implementation.

## Public surface and API

Other modules may call `NotificationPreferencesService.isOptionalEmailEnabled(userId, category)`
before optional delivery. Missing rows evaluate to disabled. No existing security mail path consults
this service.

- `GET /api/v1/users/me/notification-preferences` returns effective defaults without writing.
- `PATCH /api/v1/users/me/notification-preferences` replaces both optional email values and uses
  `expectedVersion` for optimistic concurrency.

Both routes require authentication. The stable module error
`NOTIFICATION_PREFERENCES_VERSION_CONFLICT` returns `409` for stale versions and initial-write races.
DTO validation failures return the canonical `422 VALIDATION_ERROR` response.

## Persistence and security

Migration `1787702400000-CreateNotificationPreferences` creates one row per user with a cascading
foreign key, boolean opt-ins, and a positive version. A first update must use version `0`; stored
versions begin at `1`. Transactions and row locks serialize updates, and repeated equal updates do
not increment the version.

The API never accepts a user ID, so one account cannot alter another account's choices. Responses
contain no delivery address. Request and correlation IDs remain available through the global request
context and error contract; this synchronous workflow creates no background job or outbound call.

## Verification and rollback

Tests cover default behavior, opt-in evaluation, initial persistence, stale updates, HTTP delegation,
and repository locking. Rollback drops only `notification_preferences`; mandatory security delivery
is unaffected.

## Cursor pagination rationale

Not applicable. This module exposes one resource for the authenticated user and no collection API.
