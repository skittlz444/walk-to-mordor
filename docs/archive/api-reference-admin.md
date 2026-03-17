---
name: api-reference-admin
description: Admin-only API endpoints for dashboard, goals CRUD, user management, and metrics.
---

# API Reference — Admin Endpoints

Last updated: 2026-03-17

> See [api-reference.md](api-reference.md) for auth, progress, fellowship, and friends endpoints.
> Handler source: `src/admin-handlers.ts` — read it for exact payloads, validation, and error messages.

## Admin Auth Model

- All endpoints require `Authorization: Bearer <token>` from a user with `is_admin = 1`.
- Returns `401` for unauthenticated requests, `403` for non-admin users.
- Every mutating action is logged via `logAdminAction` with a specific action string (see Audit Logging below).

## Audit Logging

All write operations create an audit log entry. Action strings:

| Action | Trigger |
|---|---|
| `update_goal` | Goal created or updated |
| `verify_user_email` | Manual email verification |
| `trigger_password_reset` | Admin-initiated password reset |
| `toggle_admin_access` | Admin flag toggled |
| `delete_user` | User hard-deleted |

## Route → Handler Map

### Dashboard & Metrics

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/dashboard` | Live system stats (no caching). Counts verified users, total distance, active parties, goals. |
| GET | `/api/admin/metrics` | Community summary: total distance, active walkers (7-day window), milestones unlocked. |
| GET | `/api/admin/metrics/leaderboard` | Per-user distance totals. Optional `start`/`end` date range (`YYYY-MM-DD`, must be paired). Includes zero-distance users via LEFT JOIN. Ordered by `distance_km DESC`. |
| GET | `/api/admin/metrics/timeline` | Fixed 30-day daily activity chart. Always 30 points, ascending. No query params. |

### Goal Management

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/goals` | Paginated + searchable. Params: `page`, `pageSize` (max 100), `search`, `order` (asc/desc by distance). |
| GET | `/api/admin/goals/:id` | Single goal detail. |
| POST | `/api/admin/goals` | Create goal. Accepts `distance_miles` — stored as `miles × 1.60934` km. |
| PUT | `/api/admin/goals/:id` | Update goal. All fields validated server-side. |

**Non-obvious goal constraints:**
- `image_id` must match slug format: `/^[a-z0-9]+(-[a-z0-9]+)*$/` — or be null/empty.
- `image_id` references static assets in `public/img/` (not R2).
- POST uses `distance_miles` (converted to km); PUT uses `distance` (already in km).
- `special` and `image_id`: empty strings are normalized to `null` on save.
- Goal IDs must be positive integers; non-positive or non-integer → `400`.

### Image Inventory

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/images` | Cross-references build-time manifest against goal `image_id` assignments. Returns `orphaned` slugs (in manifest but no goal) and `missing` slugs (goal references but not in manifest). Returns `503` if manifest unavailable (`npm run build:manifest`). |

### User Management

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/users` | Paginated + searchable. `search` matches against username, email, and active fellowship names. Ordered by `created_at DESC`. |
| PUT | `/api/admin/users/:id/verify` | Manually verify email. Idempotent. |
| PUT | `/api/admin/users/:id/reset` | Send password reset email via Resend. On email failure: token deleted, failure logged, returns `502`. |
| PUT | `/api/admin/users/:id/admin` | Toggle `is_admin`. Self-protection: cannot remove own admin access. |
| DELETE | `/api/admin/users/:id` | **Hard-delete. Irreversible.** Cascades via D1 foreign keys. Requires `{ "confirmation": "<exact username>" }` in body. Cannot self-delete. |

**Non-obvious user constraints:**
- `last_active_date` is null if user has no progress entries.
- `fellowship_names` in user list contains only active (non-dissolved) parties.
- `pageSize` is clamped to 1–100 server-side.
- Leaderboard date params must both be present or both absent; mismatched → `400`.
