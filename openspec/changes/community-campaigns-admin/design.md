## Context

The `community-campaigns` change creates the `campaign_definitions` table and seeds an initial campaign. This change adds the admin CRUD layer on top of that table and an inline management island on the existing `/admin` dashboard page.

The admin dashboard already renders `AdminDashboardIsland` (stats) and will also render `AdminEncountersIsland` (personal encounter definitions, from `personal-challenges-admin`). This change adds a third island for campaign management below those.

The existing admin patterns used by this change:
- Handler files per domain (e.g., `encounter-admin-handlers.ts`)
- Admin session validation via `validateAdminSession`
- Audit logging via `logAdminAction` from `admin-handlers.ts`
- Preact islands registered in `client/src/index.tsx`
- Inline badge definition management (auto-create/update on definition save)

## Goals / Non-Goals

**Goals:**
- Provide admin APIs to list, create, update, enable, disable, and inspect community campaign definitions.
- Provide a metric suggestion endpoint that recommends target distance, duration, and expected participant count based on recent community walking data.
- Validate campaign fields (slug, name, dates, target distance, badge metadata) before persistence.
- Show a management section on the admin dashboard with the list of campaigns, inline create/edit forms, and enable/disable controls.
- Log all mutation actions to `admin_audit_log`.

**Non-Goals:**
- No analytics dashboard for campaign performance.
- No bulk import/export of campaign definitions.
- No campaign cloning.
- No campaign notification management.

## Decisions

### Use a separate Preact island on the same admin page

Create `AdminCommunityCampaignsIsland` as a separate island rendered via `<div data-island="AdminCommunityCampaignsIsland">` placed below the existing admin islands in `renderAdminPage.ts`. This follows the same pattern as `AdminEncountersIsland`.

### Use RESTful admin endpoints under /api/admin/campaigns

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/admin/campaigns/suggestions` | Get community metric suggestions |
| GET | `/api/admin/campaigns` | List all definitions |
| POST | `/api/admin/campaigns` | Create a new definition |
| GET | `/api/admin/campaigns/:id` | Get a single definition |
| PUT | `/api/admin/campaigns/:id` | Update definition fields |
| PUT | `/api/admin/campaigns/:id/enable` | Enable a campaign |
| PUT | `/api/admin/campaigns/:id/disable` | Disable a campaign |

**Route ordering note**: `/api/admin/campaigns/suggestions` MUST be matched before `/api/admin/campaigns/:id`, otherwise `suggestions` will be parsed as a campaign ID parameter and produce a misleading error. In the if/else chain, the exact-path match for `/suggestions` is checked first, then the parameterized `/:id` is matched.

Rationale: follows the same pattern as personal encounters and existing admin resources.

### Community metric suggestions from recent walking data

`GET /api/admin/campaigns/suggestions` queries the last 30 days of community walking data and returns:
- `suggestedTargetDistance`: total_30day_distance / max(active_users, 1) * suggested_days * expected_opt_in_rate
- `suggestedDurationDays`: 7 (default), 14, or 30 based on target
- `suggestedParticipantCount`: count of active users in the past 30 days
- `thirtyDayTotalDistance`: raw total for admin reference
- `thirtyDayActiveUsers`: raw user count for admin reference

Rationale: admins need data-driven suggestions for setting realistic targets. The suggestions are calculated from recent community activity with conservative defaults. All values are editable — the admin can override any suggestion.

### Validate fields at the API layer with field-level error responses

Validation rules:
- `slug`: required, max 80 chars, kebab-case, unique
- `name`: required, max 120 chars
- `description`: required, max 2000 chars
- `image_slug`: required, max 120 chars
- `badge_slug`: required, max 120 chars; if no matching `achievement_definitions` row and inline badge fields are provided, auto-create the achievement definition
- `target_distance`: required, number > 0
- `start_date`: required, ISO date, must be today or later
- `end_date`: required, ISO date, must be after start_date
- `enabled`: boolean, defaults to false on create

### Badge management inline in the campaign form (same as encounters)

The campaign form includes inline badge fields (name, description, image_slug) that auto-create or update the `achievement_definitions` row on save. Reuses the same pattern established by `personal-challenges-admin`.

### Disable confirmation when active participants exist

When disabling a campaign with active participants (any `campaign_participants` rows), a confirmation modal appears with the participant count. The admin can choose to leave active participations running or cancel them. Follows the same two-option pattern as encounter disable.

### No new D1 migrations

This change reads and writes only the `campaign_definitions` table from the `community-campaigns` change. No schema changes.

### Separate handler file

Create `src/campaign-admin-handlers.ts` following the `encounter-admin-handlers.ts` pattern. Imports `logAdminAction` from `admin-handlers.ts`.

## Risks / Trade-offs

- [Metric suggestions may mislead for small communities] → Suggestions show the assumptions used; admins can override.
- [Active participant cancellation may surprise users] → Confirmation modal with count; audit log records the action.

## Migration Plan

1. Create `src/campaign-admin-handlers.ts` with admin CRUD and suggestion handlers.
2. Wire routes into `src/index.ts` under the admin block and `getAllowedMethods`.
3. Create `AdminCommunityCampaignsIsland` island with inline badge fields.
4. Register island and add to `renderAdminPage.ts`.
5. Add Jest and Vitest coverage.
6. Update docs.

Rollback: remove island div, route blocks, handler file, and island registration. No schema to revert.

## Open Questions

None.
