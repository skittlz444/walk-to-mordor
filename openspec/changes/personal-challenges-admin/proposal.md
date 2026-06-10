## Why

The `personal-challenges` change seeds only the Nazgul pursuit encounter via migration. Without an admin interface, adding new encounters (Moria chase, Minas Tirith defense) requires manual migration writing. This change gives admins a UI on the admin dashboard to manage personal encounter definitions — creating, editing, enabling, disabling, and tuning them — so new encounters can be authored without code changes.

## What Changes

- Add admin API endpoints for listing, creating, updating, enabling, disabling, and inspecting personal encounter definitions.
- Add an `AdminEncountersIsland` Preact island embedded on the `/admin` dashboard page below the existing dashboard stats, registered through the existing island registry.
- Build admin UI for managing encounter definition fields: event copy, image slug, duration in days, target stretch multiplier, target min/max distance brackets, is_repeatable flag, enabled state, and badge metadata (name, image slug, description).
- Add admin audit logging for encounter definition mutations using the existing `admin_audit_log` table.
- Validate definition fields before save and surface validation errors clearly in the UI.

## Capabilities

### New Capabilities
- `personal-challenges-admin`: Admin CRUD APIs for personal encounter definitions and a dashboard-embedded management island for authoring and tuning personal encounters.

### Modified Capabilities
- None.

## Impact

- Worker APIs: new admin endpoints under `/api/admin/encounters` for CRUD operations on `personal_encounter_definitions`, guarded by the existing `validateAdminSession` check. No new tables — reads and writes the `personal_encounter_definitions` table created by the `personal-challenges` change.
- Frontend: new `AdminEncountersIsland` Preact island registered in `client/src/index.tsx` and added to the admin dashboard via `data-island` in `renderAdminPage.ts`.
- Admin audit: insert rows into the existing `admin_audit_log` table on encounter definition create, update, and enable/disable actions.
- CSS: new encounter management styles within the existing admin CSS patterns, without contaminating unrelated admin selector blocks.
- Tests: Jest coverage for admin API auth, validation, and CRUD; Vitest coverage for the admin island form behavior and validation error display.
- Documentation: update `docs/api-reference.md` with admin encounter endpoints.
