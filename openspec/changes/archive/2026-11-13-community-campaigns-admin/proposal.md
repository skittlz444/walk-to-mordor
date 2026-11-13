## Why

The `community-campaigns` change seeds a campaign via migration, but without an admin interface, creating new campaigns requires writing migrations. This change gives admins a UI on the admin dashboard to manage community campaigns — creating, editing, setting target distances and date windows, linking completion badges — so new campaigns can be authored without code changes.

## What Changes

- Add admin API endpoints for listing, creating, updating, enabling, disabling, inspecting, and retriggering community campaigns.
- Add community metric suggestion logic that calculates recommended target distance and expected participant count from recent community walking data for an admin-supplied duration.
- Add an `AdminCommunityCampaignsIsland` Preact island embedded on the `/admin` dashboard page below existing admin islands, registered through the existing island registry.
- Build admin UI for managing campaign fields: name, slug, description, image slug, target distance, start date, end date, enabled state, badge metadata (name, image slug, description, repeatability, rank thresholds), and visibility settings.
- Freeze the active run's `target_distance` and `start_date` plus the campaign's `badge_slug` once a run leaves `upcoming` status; allow end-date extensions only.
- Restrict inline badge auto-create/update to `badge_type='community'` definitions so admins cannot mutate unrelated badges.
- Mark participants `removed` when disabling with `cancelActive: true`; re-enabling triggers the campaign backfill.
- Add a retrigger action that creates a campaign's next run when the latest run is completed or expired: pre-filled target from the suggestions formula (clamped to >= 1 km), a suggested 14-day window (start defaulting to tomorrow), fully overridable before confirmation. Manual admin trigger only — run cadence is unset by design and the cron never creates runs.
- Add admin audit logging for campaign definition mutations using the existing `admin_audit_log` table.
- Validate campaign fields before save and surface validation errors clearly in the UI.
- When the `community-campaign-notifications` change is applied, a run is announced when it first becomes publicly visible (enable of an unannounced run, or retrigger of an enabled campaign).

## Capabilities

### New Capabilities
- `community-campaigns-admin`: Admin CRUD APIs for community campaign definitions, community metric suggestions, and a dashboard-embedded management island for authoring and tuning community campaigns.

### Modified Capabilities
- `events-and-challenges`: Modifies the `Admin event management` requirement to reflect the delivered split dashboard surfaces (encounters island plus campaigns island) instead of a single unified event-management UI. See `specs/events-and-challenges/spec.md`.

## Impact

- Worker APIs: new admin endpoints under `/api/admin/campaigns` for CRUD, suggestions, and retrigger on `campaign_definitions`/`campaign_runs`, guarded by the existing `adminGuard` middleware. No new tables — reads and writes the tables created by the `community-campaigns` change.
- Frontend: new `AdminCommunityCampaignsIsland` Preact island registered in `client/src/index.tsx` and added to the admin dashboard via `data-island` in `renderAdminPage.ts`.
- Admin audit: insert rows into the existing `admin_audit_log` table on campaign definition create, update, and enable/disable actions.
- CSS: new campaign management styles added to the existing admin stylesheet (`public/css/admin.css`, loaded by `renderAdminShell`), without contaminating unrelated admin selector blocks.
- Tests: Jest coverage for admin API auth, validation, CRUD, and metric suggestions; Vitest coverage for the admin island form behavior and validation error display.
- Documentation: update `docs/api-reference.md` with admin campaign endpoints.
