# API Reference

Last updated: 2026-03-06

Base URL is the same Worker origin as the web app.

## Authentication Contract

Protected endpoints require:

- Header: `Authorization: Bearer <sessionToken>`

Behavior:

- Missing/invalid bearer header returns `401`.
- Session ownership and active membership checks return `403` where applicable.
- Unknown API paths return `404`.
- Method mismatch returns `405` and an `Allow` header.

Test-only auth mode:

- When Worker var `ALLOW_TEST_AUTH=true`, tokens prefixed with `TEST_MOCK_TOKEN_` are accepted in tests.

## Auth and Profile Endpoints

### `POST /api/register`

Creates a user and triggers confirmation email flow.

Body:

```json
{ "username": "samwise", "email": "sam@example.com", "password": "..." }
```

### `POST /api/login`

Authenticates a user and returns session token payload consumed by the client.

### `POST /api/logout`

Invalidates current session.

### `GET /api/session`

Returns current session user context.

Typical response fields:

```json
{
  "userId": 1,
  "username": "samwise",
  "email": "sam@example.com",
  "showFutureGoalsUnlocked": true,
  "defaultViewMap": false,
  "expiresAt": "2026-03-07T..."
}
```

### `PUT /api/profile`

Updates profile properties (username/email/password fields as supported by handler validation).

### `PUT /api/user/preferences`

Updates user preferences.

Body:

```json
{ "showFutureGoalsUnlocked": true, "defaultViewMap": false }
```

### `POST /api/password-reset-request`

Requests password reset email.

### `POST /api/password-reset`

Completes reset using token.

### `GET /api/auth/confirm-email`

Confirms email with query token.

### `POST /api/auth/resend-confirmation`

Resends confirmation email.

## Progress and Goal Endpoints

### `GET /api/calendar-progress`

Returns current user's logged distance entries.

### `POST /api/calendar-progress`

Creates a progress entry.

Body:

```json
{ "date": "2026-03-06", "distance": 7.5 }
```

### `PUT /api/calendar-progress`

Updates an existing progress entry.

Body:

```json
{ "id": 42, "date": "2026-03-06", "distance": 8.0 }
```

### `DELETE /api/calendar-progress`

Deletes an entry.

Body:

```json
{ "id": 42 }
```

### `GET /api/total-distance`

Returns calculated cumulative distance.

```json
{ "totalDistance": 123.45 }
```

### `GET /api/goals`

Returns milestone goals, including optional imagery metadata (`image_id`).

## Fellowship (Party) Endpoints

### `POST /api/party`

Creates a new party.

Body:

```json
{
  "name": "The Nine Walkers",
  "distance_mode": "incremental",
  "leave_distance_behavior": "keep"
}
```

Returns `201` with party metadata and `invite_code`.

### `GET /api/user/parties`

Returns current active party memberships.

Optional query:

- `include_dissolved=true`

### `GET /api/party/join/:inviteCode`

Public preview of an invite target (no auth required).

Returns party summary, including `member_count`, `distance_mode`, `leave_distance_behavior`.

### `POST /api/party/join/:inviteCode`

Joins or rejoins a party.

### `POST /api/party/:id/invite`

Leader-only invite code regeneration.

### `GET /api/party/:id/progress`

Returns aggregated party progress including:

- `total_distance`
- `user_total_distance`
- `calculated_position`
- `next_position`
- `members[]` contributions and status
- `newly_passed_milestones[]`

### `GET /api/party/:id/activity`

Returns recent party activity feed (up to last 10 entries).

### `POST /api/party/:id/leave`

Marks member as left and applies leave-distance policy.

### `POST /api/party/:id/kick/:userId`

Leader-only member removal.

Optional body override:

```json
{ "removeDistance": true }
```

### `PUT /api/party/:id/settings`

Leader-only updates for mutable party settings.

Body fields:

- `name`
- `leave_distance_behavior`

`distance_mode` is immutable and rejected if provided.

### `POST /api/party/:id/transfer-leadership`

Leader-only transfer.

Body:

```json
{ "new_leader_id": 123 }
```
