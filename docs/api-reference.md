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

**Request body:**

```json
{
  "sessionId": "<session-token>"
}
```

Returns `400` if `sessionId` is missing from the body.

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

### `POST /api/party/:id/invite-friend`

Invite a friend to a fellowship. The friend must accept to join.

Auth: Required (must be active member of party).

Body:

```json
{ "user_id": 456 }
```

Validates:
- Inviter is active member of party
- Invitee is an accepted friend of inviter
- Invitee is not already an active member
- Party is not dissolved

Returns `201` with invite details.

Errors: `400` (already member, not friends, dissolved), `403` (not a member), `404` (user/party not found).

### `GET /api/user/fellowship-invites`

Returns pending incoming fellowship invites for the current user.

Auth: Required.

Response:

```json
{
  "invites": [
    {
      "id": 1,
      "party_id": 10,
      "party_name": "The Nine Walkers",
      "member_count": 5,
      "total_distance": 1234.5,
      "inviter_username": "aragorn",
      "created_at": "2026-03-09T12:00:00Z"
    }
  ],
  "count": 1
}
```

### `POST /api/user/fellowship-invites/:inviteId/accept`

Accept a fellowship invite. Joins the party (same join logic as invite-code flow).

Auth: Required (must be the invitee).

### `POST /api/user/fellowship-invites/:inviteId/reject`

Reject a fellowship invite. Marks invite as rejected.

Auth: Required (must be the invitee).

## Friends Endpoints

### `GET /api/friends`

Returns the current user's accepted friends list.

Auth: Required.

Response:

```json
{
  "friends": [
    {
      "friendship_id": 1,
      "user_id": 42,
      "username": "samwise",
      "avatar_id": "samwise",
      "last_progressed": "2026-03-08"
    }
  ]
}
```

`last_progressed` is the date of the friend's most recent progress entry (null if no walks logged).

### `GET /api/friends/pending`

Returns pending incoming friend requests.

Auth: Required.

Response:

```json
{
  "requests": [
    {
      "friendship_id": 5,
      "user_id": 99,
      "username": "legolas",
      "avatar_id": null,
      "created_at": "2026-03-09T10:00:00Z"
    }
  ],
  "count": 1
}
```

### `GET /api/friends/search?q=<username>`

Search users by username prefix. Minimum 3 characters.

Auth: Required.

Response:

```json
{
  "results": [
    {
      "user_id": 42,
      "username": "samwise",
      "avatar_id": "samwise",
      "friendship_status": "accepted"
    }
  ]
}
```

`friendship_status`: `null` (no relationship), `"pending"` (request exists), `"accepted"` (already friends). Excludes current user. Limit 10 results.

### `GET /api/friends/resolve/:friendCode`

Resolve a friend code to a user preview. Used by the friend link landing page.

Auth: Not required (public preview).

Response:

```json
{
  "user_id": 42,
  "username": "samwise",
  "avatar_id": "samwise"
}
```

Errors: `404` (invalid friend code).

### `GET /api/friends/positions`

Returns each friend's total distance for map position interpolation.

Auth: Required.

Response:

```json
{
  "friends": [
    {
      "user_id": 42,
      "username": "samwise",
      "avatar_id": "samwise",
      "total_distance": 245.5
    }
  ]
}
```

Only returns accepted friends. Position interpolation is performed client-side using existing path coordinate utilities. Recommended client cache: 5 minutes.

### `POST /api/friends/request`

Send a friend request by user ID.

Auth: Required.

Body:

```json
{ "user_id": 42 }
```

Returns `201` with friendship record. Errors: `400` (already friends/pending, self-add), `404` (user not found).

Rate limit: max 20 outgoing pending requests at any time.

### `POST /api/friends/request/code`

Send a friend request via friend code.

Auth: Required.

Body:

```json
{ "friend_code": "Ab3xK9mZ" }
```

Resolves code to user and creates pending friendship. Same validation and rate limits as `POST /api/friends/request`.

### `POST /api/friends/:friendshipId/accept`

Accept a pending friend request. Only the addressee can accept.

Auth: Required.

### `POST /api/friends/:friendshipId/reject`

Reject a pending friend request. Deletes the friendship record. Only the addressee can reject.

Auth: Required.

### `DELETE /api/friends/:friendshipId`

Remove an existing friend (mutual unfriend). Deletes the friendship record. Either party can remove.

Auth: Required.

IDOR prevention: all friendship operations validate the current user is a party to the friendship record.

### `GET /api/friends/:userId/profile`

Returns a friend's profile details. Only accessible for accepted friends (returns 404 for non-friends — privacy enforcement).

Auth: Required.

Response:

```json
{
  "username": "samwise",
  "avatar_id": "samwise",
  "total_distance": 245.5,
  "member_since": "2026-01-15T00:00:00Z",
  "current_goal_title": "Rivendell",
  "fellowships": [
    { "id": 1, "name": "The Fellowship", "is_shared": true },
    { "id": 5, "name": "Hobbits Only", "is_shared": false }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `total_distance` | number | Sum of all progress entries (km) |
| `member_since` | string | User's `created_at` timestamp |
| `current_goal_title` | string | Next unlocked goal title (first goal whose distance exceeds the friend's total) |
| `fellowships` | array | Non-dissolved parties the friend is an active member of |
| `is_shared` | boolean | Whether the current user is also an active member of that party |

Errors: `400` (malformed userId), `401` (unauthenticated), `404` (not friends or user not found).

## Admin Endpoints

All admin endpoints require `Authorization: Bearer <token>` from an admin user (`is_admin = 1`). Returns `401` for unauthenticated requests and `403` for non-admin users.

### `GET /api/admin/dashboard`

Returns live system statistics. No caching — always queries D1 directly.

Response:

```json
{
  "totalUsers": 42,
  "totalDistanceKm": 12345.6,
  "activeParties": 5,
  "totalGoals": 171
}
```

| Field | Type | Description |
|---|---|---|
| `totalUsers` | number | Count of users with `email_verified = 1` |
| `totalDistanceKm` | number | Sum of all progress entries (km), rounded to 1 decimal |
| `activeParties` | number | Parties with at least one active member |
| `totalGoals` | number | Total goal/milestone count |

Error responses:

- `401` — Missing or invalid bearer token
- `403` — `{"error": "Admin access required"}`
- `500` — Database error

### `GET /api/admin/goals`

Returns a paginated, searchable, sortable list of goals.

Query parameters:

| Param | Default | Description |
|---|---|---|
| `page` | `1` | Page number |
| `pageSize` | `25` | Results per page (max 100) |
| `search` | — | Filter title LIKE `%term%` |
| `order` | `asc` | Sort by distance (`asc` or `desc`) |

Response:

```json
{
  "goals": [
    { "id": 1, "title": "Bag End", "distance": 0, "description": "...", "special": null, "image_id": "bag-end", "has_image": true }
  ],
  "total": 171,
  "page": 1,
  "pageSize": 25,
  "totalPages": 7
}
```

### `GET /api/admin/goals/:id`

Returns a single goal's full details.

Response (`200`):

```json
{
  "id": 42,
  "title": "Rivendell",
  "distance": 747.8,
  "description": "The company arrives at the Last Homely House...",
  "special": null,
  "image_id": "rivendell"
}
```

Error responses:

- `400` — `{"error": "Invalid goal ID"}` — non-integer or non-positive ID
- `401` — Missing or invalid bearer token
- `403` — `{"error": "Admin access required"}`
- `404` — `{"error": "Goal not found"}`
- `500` — Internal server error

### `PUT /api/admin/goals/:id`

Updates an existing goal's editable fields.

Request body:

```json
{
  "title": "Rivendell",
  "distance": 747.8,
  "description": "Updated description...",
  "special": null,
  "image_id": "rivendell"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | Yes | Non-empty after trim |
| `distance` | number | Yes | Must be positive |
| `description` | string | Yes | Non-empty after trim |
| `special` | string \| null | No | Empty string → `null` |
| `image_id` | string \| null | No | Slug format (`/^[a-z0-9]+(-[a-z0-9]+)*$/`), empty → `null` |

Response (`200`): Returns the updated goal object (same shape as GET).

Creates an audit log entry via `logAdminAction` with action `update_goal`.

Validation error responses (`400`):

- `{"error": "Title is required"}`
- `{"error": "Distance must be a positive number"}`
- `{"error": "Description is required"}`
- `{"error": "Image ID must be a valid slug format"}`
- `{"error": "Invalid goal ID"}` — non-integer/non-positive ID

Other errors:

- `401` — Missing or invalid bearer token
- `403` — `{"error": "Admin access required"}`
- `404` — `{"error": "Goal not found"}`
- `500` — Internal server error

### `GET /api/admin/images`

Returns an image asset inventory cross-referencing the build-time manifest against goal `image_id` assignments.

Response (`200`):

```json
{
  "images": [
    { "image_id": "bag-end", "has_highres": true, "has_thumb": true },
    { "image_id": "rivendell", "has_highres": true, "has_thumb": true }
  ],
  "total": 192,
  "orphaned": ["old-unused-image"],
  "missing": [
    { "goal_id": 42, "title": "Some Goal", "image_id": "missing-slug" }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `images` | array | Goal `image_id` values that exist in the deployed manifest |
| `total` | number | Count of image slugs in the manifest |
| `orphaned` | string[] | Manifest slugs not referenced by any goal's `image_id` |
| `missing` | array | Goals whose `image_id` references files not in the manifest |

Error responses:

- `401` — Missing or invalid bearer token
- `403` — `{"error": "Admin access required"}`
- `503` — Image manifest not available (run `npm run build:manifest`)
- `500` — Internal server error

### `POST /api/admin/goals`

Creates a new goal in the journey. Distance is provided in miles and stored as km internally.

Request body:

```json
{
  "title": "Camp at Weathertop",
  "distance_miles": 120.5,
  "description": "A camp near the ancient watchtower.",
  "special": "Optional special event text",
  "image_id": "weathertop"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | Yes | Goal title (non-empty) |
| `distance_miles` | number | Yes | Distance in miles (positive); stored as `miles × 1.60934` km |
| `description` | string | No | Markdown description of the goal |
| `special` | string | No | Special event text |
| `image_id` | string | No | Kebab-case slug referencing `public/img/` assets |

Response (`201 Created`):

```json
{
  "id": 99,
  "title": "Camp at Weathertop",
  "distance": 193.93,
  "description": "A camp near the ancient watchtower.",
  "special": null,
  "image_id": "weathertop"
}
```

Validation errors (`400`):

- `{"error": "Invalid request body"}` — null, undefined, or non-object body
- `{"error": "Title is required"}` — empty or missing title
- `{"error": "Invalid distance value"}` — distance is not a number (string, boolean, null)
- `{"error": "Distance must be a positive number"}` — zero, negative, or Infinity distance
- `{"error": "Image ID must be a valid slug format"}` — image_id does not match `/^[a-z0-9]+(-[a-z0-9]+)*$/`

Error responses:

- `400` — Validation failure (see above)
- `401` — Missing or invalid bearer token
- `403` — `{"error": "Admin access required"}`
- `500` — Internal server error
