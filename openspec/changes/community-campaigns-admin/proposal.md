## Why

The `community-campaigns` change seeds a campaign via migration, but without an admin interface, creating new campaigns requires writing migrations. This change gives admins a UI on the admin dashboard to manage community campaigns — creating, editing, setting target distances and date windows, linking completion badges — so new campaigns can be authored without code changes.

## What Changes

- Add admin API endpoints for listing, creating, updating, enabling, disabling, and inspecting community campaign definitions.
- Add community metric suggestion logic that calculates recommended target distance, campaign duration, and expected participant count from recent community walking data.
- Add an `AdminCommunityCampaignsIsland` Preact island embedded on the `/admin` dashboard page below existing admin islands, registered through the existing island registry.
- Build admin UI for managing campaign fields: name, slug, description, image slug, target distance, start date, end date, enabled state, badge metadata (name, image slug, description), and visibility settings.
- Add admin audit logging for campaign definition mutations using the existing `admin_audit_log` table.
- Validate campaign fields before save and surface validation errors clearly in the UI.

## Capabilities

### New Capabilities
- `community-campaigns-admin`: Admin CRUD APIs for community campaign definitions, community metric suggestions, and a dashboard-embedded management island for authoring and tuning community campaigns.

### Modified Capabilities
- None.

## Impact

- Worker APIs: new admin endpoints under `/api/admin/campaigns` for CRUD operations and metric suggestions on `campaign_definitions`, guarded by the existing `validateAdminSession` check. No new tables — reads and writes the `campaign_definitions` table created by the `community-campaigns` change.
- Frontend: new `AdminCommunityCampaignsIsland` Preact island registered in `client/src/index.tsx` and added to the admin dashboard via `data-island` in `renderAdminPage.ts`.
- Admin audit: insert rows into the existing `admin_audit_log` table on campaign definition create, update, and enable/disable actions.
- CSS: new campaign management styles within the existing admin CSS patterns, without contaminating unrelated admin selector blocks.
- Tests: Jest coverage for admin API auth, validation, CRUD, and metric suggestions; Vitest coverage for the admin island form behavior and validation error display.
- Documentation: update `docs/api-reference.md` with admin campaign endpoints.
