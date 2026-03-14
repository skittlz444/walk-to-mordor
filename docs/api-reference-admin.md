# API Reference — Admin Endpoints

Last updated: 2026-03-14

> See [api-reference.md](api-reference.md) for auth, progress, fellowship, and friends endpoints.

All admin endpoints require `Authorization: Bearer <token>` from an admin user (`is_admin = 1`). Returns `401` for unauthenticated requests and `403` for non-admin users.

## Dashboard

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

## Goal Management

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

## Image Inventory

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

## User Management

### `GET /api/admin/users`

Returns a paginated, searchable list of all users with distance and fellowship data.

Query parameters:

| Param | Default | Description |
|---|---|---|
| `page` | `1` | Page number (clamped to valid range) |
| `pageSize` | `25` | Results per page (clamped 1–100) |
| `search` | — | Substring match against username, email, and active fellowship names |

Response:

```json
{
  "users": [
    {
      "id": 42,
      "username": "aragorn",
      "email": "aragorn@gondor.me",
      "email_verified": true,
      "is_admin": false,
      "total_distance_km": 120.5,
      "last_active_date": "2026-03-10",
      "fellowship_names": ["Fellowship of the Ring"]
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 25,
  "totalPages": 6
}
```

`last_active_date` is null if the user has no progress entries. `fellowship_names` contains only active (non-dissolved) parties. Results ordered by `created_at DESC`.

### `PUT /api/admin/users/:id/verify`

Manually verifies a user's email. Idempotent.

Response:

```json
{ "success": true, "email_verified": true }
```

Errors: `400` (invalid user ID), `404` (user not found). Logs `verify_user_email` to audit log.

### `PUT /api/admin/users/:id/reset`

Generates a password reset token and sends the reset email via Resend.

Response:

```json
{ "success": true, "message": "Password reset email sent" }
```

Errors: `400` (invalid user ID), `404` (user not found), `502` (email send failure). If email send fails, the token is deleted and the action is logged as failed. Logs `trigger_password_reset` to audit log.

### `PUT /api/admin/users/:id/admin`

Toggles the `is_admin` flag on the target user. Self-protection: an admin cannot remove their own admin access.

Response:

```json
{ "success": true, "is_admin": true }
```

`is_admin` reflects the new value after toggle.

Errors: `400` (invalid user ID, self-removal), `404` (user not found). Logs `toggle_admin_access` to audit log.

### `DELETE /api/admin/users/:id`

Hard-deletes a user account. Irreversible. Cascades via D1 foreign keys. Self-protection: admin cannot delete their own account.

Body:

```json
{ "confirmation": "<exact username>" }
```

The `confirmation` value must exactly match the target user's username (trimmed).

Response:

```json
{ "success": true }
```

Errors: `400` (invalid body, self-deletion, confirmation mismatch), `404` (user not found). Logs `delete_user` to audit log.

## Metrics

### `GET /api/admin/metrics`

Returns community-wide summary statistics.

Response:

```json
{
  "totalGroupDistanceKm": 4821.3,
  "activeWalkers": 17,
  "milestonesUnlocked": 142
}
```

| Field | Description |
|---|---|
| `totalGroupDistanceKm` | Sum of all progress entries (1 decimal) |
| `activeWalkers` | Distinct users with progress in last 7 days |
| `milestonesUnlocked` | Cumulative cross-user count of goals reached |

### `GET /api/admin/metrics/leaderboard`

Returns per-user distance totals with optional date range filter.

Query parameters:

| Param | Required | Description |
|---|---|---|
| `start` | Paired with `end` | `YYYY-MM-DD`, must be ≤ `end` |
| `end` | Paired with `start` | `YYYY-MM-DD` |

Both must be provided together or both omitted (all-time totals).

Response:

```json
{
  "rows": [
    { "id": 7, "username": "frodo", "email": "frodo@shire.me", "distance_km": 320.0 }
  ],
  "start": "2026-01-01",
  "end": "2026-03-14",
  "maxDistanceKm": 320.0
}
```

Includes all users (zero distance via LEFT JOIN). Ordered by `distance_km DESC`.

Errors: `400` (mismatched or invalid date params).

### `GET /api/admin/metrics/timeline`

Returns a 30-day daily activity chart (fixed window, no query params).

Response:

```json
{
  "points": [
    { "date": "2026-02-13", "distance_km": 0 },
    { "date": "2026-03-14", "distance_km": 7.1 }
  ],
  "maxDistanceKm": 41.2
}
```

Always 30 elements (one per day, ascending). Days with no activity have `distance_km: 0`.
