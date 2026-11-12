## Context

The `community-campaigns` change creates the `campaign_definitions`, `campaign_runs`, `campaign_participants`, and `campaign_progress_ledger` tables and seeds the recurring "Beacon Watch" campaign with run 1 and its repeatable badge. This change adds the admin CRUD layer on top of those tables, the retrigger action that creates a campaign's next run, and an inline management island on the existing `/admin` dashboard page.

The admin dashboard already renders `AdminDashboardIsland` (stats) and `AdminEncountersIsland` (personal encounter definitions, from `personal-challenges-admin`). This change adds a third island for campaign management below those.

The existing admin patterns used by this change:
- Handler files per domain (e.g., `encounter-admin-handlers.ts`)
- Admin auth enforced by the `adminGuard` middleware; handlers read `adminUserId` from Hono context
- Audit logging via `logAdminAction` from `admin-shared.ts` (`admin-handlers.ts` only re-exports it)
- Preact islands registered in `client/src/index.tsx`
- Inline badge definition management (auto-create/update on definition save)

## Goals / Non-Goals

**Goals:**
- Provide admin APIs to list, create, update, enable, disable, inspect, and retrigger community campaigns.
- Provide a metric suggestion endpoint that recommends target distance, duration, and expected participant count based on recent community walking data.
- Validate campaign fields (slug, name, dates, target distance, badge metadata) before persistence.
- Show a management section on the admin dashboard with the list of campaigns, inline create/edit forms, enable/disable controls, and a retrigger action for completed/expired campaigns.
- Log all mutation actions to `admin_audit_log`.

**Non-Goals:**
- No analytics dashboard for campaign performance.
- No bulk import/export of campaign definitions.
- No campaign cloning — retriggering reuses the one definition and creates a run; it is not a copy.
- No cron-driven auto-retrigger: new runs are created manually by an admin (run cadence is unset by design).
- No campaign notification management.

## Decisions

### Use a separate Preact island on the same admin page

Create `AdminCommunityCampaignsIsland` as a separate island rendered via `<div data-island="AdminCommunityCampaignsIsland">` placed below the existing admin islands in `renderAdminPage.ts`. This follows the same pattern as `AdminEncountersIsland`.

### Use RESTful admin endpoints under /api/admin/campaigns

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/admin/campaigns/suggestions` | Get community metric suggestions |
| GET | `/api/admin/campaigns` | List all definitions with run state |
| POST | `/api/admin/campaigns` | Create a new definition |
| GET | `/api/admin/campaigns/:id` | Get a single definition with run history |
| PUT | `/api/admin/campaigns/:id` | Update definition fields |
| PUT | `/api/admin/campaigns/:id/enable` | Enable a campaign |
| PUT | `/api/admin/campaigns/:id/disable` | Disable a campaign |
| POST | `/api/admin/campaigns/:id/retrigger` | Create the campaign's next run |

**Route precedence note**: `/api/admin/campaigns/suggestions` is a static path and `/api/admin/campaigns/:id` is parameterized. Hono matches the static segment first, so `suggestions` is never parsed as an id; no manual ordering is required. All routes are registered behind `adminGuard`.

Rationale: follows the same pattern as personal encounters and existing admin resources.

### Community metric suggestions from recent walking data

`GET /api/admin/campaigns/suggestions?durationDays=<n>` queries the last 30 days of community walking data and returns:
- `suggestedTargetDistance`: `total_30day_distance / max(active_users, 1) * durationDays * 0.25`, rounded to the nearest kilometer
- `suggestedDurationDays`: the requested `durationDays` (default 14, clamped to 7–30)
- `suggestedParticipantCount`: count of active users in the past 30 days
- `thirtyDayTotalDistance` and `thirtyDayActiveUsers`: raw totals for admin reference

The opt-in rate (0.25) is a documented handler constant, not a user-editable field. The formula is deterministic so two implementations produce the same suggestion, and the admin can override any value.

Rationale: admins need data-driven suggestions for setting realistic targets. The suggestions are calculated from recent community activity with a conservative, documented assumption.

### Validate fields at the API layer with field-level error responses

Validation rules:
- `slug`: required, max 80 chars, kebab-case, unique
- `name`: required, max 120 chars
- `description`: required, max 2000 chars
- `image_slug`: required, max 120 chars
- `badge_slug`: required, max 120 chars; if no matching `achievement_definitions` row and inline badge fields are provided, auto-create the achievement definition. Only definitions with `badge_type='community'` may be updated — never overwrite another badge type
- `target_distance`: required, number > 0
- `start_date`: required, ISO date, must be today (UTC) or later **on create only**; on update any valid ISO date is accepted while the campaign is still upcoming (the field is frozen afterwards)
- `end_date`: required, ISO date, must be after start_date
- `enabled`: boolean, defaults to false on create

Once a run leaves `upcoming` status, its `target_distance`, `start_date`, and the campaign's `badge_slug` are immutable; the run's `end_date` may be extended but not shortened. Copy fields (`name`, `description`, `image_slug`) remain editable. Retriggering is not an edit: it creates a **new run** with its own values, so the freeze on the previous run is never violated.

### Badge management inline in the campaign form (same as encounters)

The campaign form includes inline badge fields (name, description, image_slug) that auto-create or update the `achievement_definitions` row on save. Reuses the same pattern established by `personal-challenges-admin`. The inline badge section also carries a repeatability checkbox and, when repeatable, a rank-thresholds list (stored as `metadata.rank_thresholds`; `metadata.rank` is never set, because it would override the thresholds). Without this, an admin-created badge defaults to `is_repeatable = 0` and can never escalate across runs.

### Retrigger creates the campaign's next run

`POST /api/admin/campaigns/:id/retrigger` is allowed only when the campaign's latest run is `completed` or `expired` — never while a run is upcoming or active, and never for a disabled campaign (enable first). The request may carry overrides; the server pre-fills from the suggestions endpoint:
- `target_distance`: the suggested target (`total_30day / max(active_users, 1) * durationDays * 0.25`, clamped to at least 1 km), admin-overridable
- `start_date`: defaults to tomorrow (UTC) so the 09:00 UTC cron never strands the run in upcoming past its window; must be today or later
- `end_date`: defaults to `start_date + 13` (a 14-day inclusive window — the suggested default length; run cadence beyond that is the admin's choice, this change imposes none)

The action runs as one D1 batch: insert the next run (`run_number` = max+1, `status = 'upcoming'`, `announced_at = NULL`), audit-log `retrigger_campaign`, and never modify or delete previous runs, participant rows, or ledger entries. When the `community-campaign-notifications` change is applied, the retrigger route dispatches the run-announcement notification via the route-layer scheduling callback (the run's `announced_at` is stamped by that path).

Rationale: retrigger-as-create keeps the run model append-only, sidesteps the active-run freeze entirely, and gives the per-run badge key a stable identity. Manual triggering keeps cadence in human hands.

### Disable confirmation when active participants exist

When disabling a campaign with active participants (`campaign_participants.status = 'active'`), a confirmation modal appears with the participant count. The admin chooses:
- `cancelActive: false` — set `enabled = 0` and leave participant rows untouched (campaign frozen; crediting paused)
- `cancelActive: true` — set `enabled = 0`, mark all active participants `status = 'removed'` with `removed_at`, and keep ledger rows and earned badges

Disabled campaigns are frozen: no reconciliation, completion, lifecycle transitions, or joining. Re-enabling runs the same backfill as joining, so in-window walks are credited without walk re-saves.

### Runs visibility and announcements

Campaign create stores `enabled = false`, and the seeded and retriggered runs carry `announced_at = NULL`. A run is announced (per the `community-campaign-notifications` change) when it **first becomes publicly visible**: enabling a disabled campaign announces its unannounced upcoming/active run; retriggering an enabled campaign announces the new run immediately. One-shot campaigns and recurring campaigns share this single rule. Campaigns inserted directly by migration stay silent until an admin enables them.

### No new D1 migrations

This change adds no migrations of its own: it reads and writes `campaign_definitions`, `campaign_runs`, and `campaign_participants` (including the `status`/`removed_at` columns) created by the `community-campaigns` change.

### Separate handler file

Create `src/campaign-admin-handlers.ts` following the `encounter-admin-handlers.ts` pattern. Imports `logAdminAction` from `admin-shared.ts`; handlers rely on `adminGuard` and read `adminUserId` from Hono context.

## Risks / Trade-offs

- [Metric suggestions may mislead for small communities] → Suggestions show the documented assumptions (30-day window, 0.25 opt-in rate); admins can override every value; the retrigger target is clamped to at least 1 km.
- [Active participant cancellation may surprise users] → Confirmation modal with count; audit log records the action; earned badges are never revoked.
- [Editing an active run could retarget the goal] → The run's `target_distance`, `start_date`, and the campaign's `badge_slug` are frozen once the run leaves `upcoming`; `end_date` can only be extended.
- [Disabling hides a campaign from participants] → Participant rows, ledger history, and earned badges are retained; re-enabling backfills the window and restores public visibility.
- [Retrigger depends on a human] → A forgotten retrigger simply leaves the campaign dormant after its last run; the island surfaces the latest run's outcome so the next action is obvious.

## Migration Plan

1. Create `src/campaign-admin-handlers.ts` with admin CRUD, suggestion, and retrigger handlers.
2. Register routes on the Hono app in `src/index.ts` behind `adminGuard`.
3. Create `AdminCommunityCampaignsIsland` island with inline badge fields and the retrigger action.
4. Register the island and add it to `renderAdminPage.ts`.
5. Add Jest and Vitest coverage.
6. Update docs.

Rollback: remove island div, route blocks, handler file, and island registration. No schema to revert.

## Open Questions

None.
