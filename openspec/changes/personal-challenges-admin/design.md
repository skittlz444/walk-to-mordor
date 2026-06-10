## Context

The `personal-challenges` change creates the `personal_encounter_definitions` table and seeds the Nazgul pursuit. This change adds the admin CRUD layer on top of that table and an inline management UI on the existing `/admin` dashboard page.

The admin page already renders `AdminDashboardIsland` (stats) inside an SSR shell from `renderAdminPage.ts`. The shell also contains navigation links to other admin sections (goals, storylines, users, metrics). This change adds a second island below the dashboard stats.

The existing pattern for admin CRUD follows:
- Handlers in domain-specific files (e.g., `admin-handlers.ts`) with `handleAdminXxx` naming
- Admin session validation via `validateAdminSession` in `src/index.ts`
- Audit logging to `admin_audit_log` table on mutation actions
- Preact islands registered in `client/src/index.tsx` and hydraed via `data-island` attributes

## Goals / Non-Goals

**Goals:**
- Provide admin APIs to list, create, update, enable, disable, and inspect personal encounter definitions.
- Validate definition fields (slug, duration_days, stretch multiplier, target brackets, badge metadata) before persistence.
- Show a management section on the admin dashboard with the list of definitions, inline edit/create forms, and enable/disable controls.
- Log all mutation actions to `admin_audit_log`.
- Reuse existing admin CSS patterns without inserting rules into unrelated selector blocks.

**Non-Goals:**
- No bulk import/export of encounter definitions.
- No encounter analytics or performance statistics.
- No preview/playtest mode (testing encounters requires real user interaction).
- No template duplication or cloning feature.
- No multi-admin collaboration features.

## Decisions

### Use a separate Preact island on the same admin page

Create `AdminEncountersIsland` as a separate island rendered via `<div data-island="AdminEncountersIsland">` placed below the existing `AdminDashboardIsland` in `renderAdminPage.ts`. Both islands share the `/admin` page and navigation.

Rationale: the admin dashboard island already handles stats. Adding encounter management to it would make it a monolithic component. A separate island keeps concerns separated while sharing the same page — admins see stats above and encounter management below, all on one screen.

Alternative considered: a new `/admin/encounters` page. Rejected because the user explicitly wants encounters inline on the dashboard for quick access.

### Use RESTful admin endpoints under /api/admin/encounters

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/admin/encounters` | List all definitions with status |
| POST | `/api/admin/encounters` | Create a new definition |
| GET | `/api/admin/encounters/:id` | Get a single definition |
| PUT | `/api/admin/encounters/:id` | Update definition fields |
| PUT | `/api/admin/encounters/:id/enable` | Enable a definition |
| PUT | `/api/admin/encounters/:id/disable` | Disable a definition |

Rationale: matches the existing admin API pattern (`/api/admin/goals`, `/api/admin/storylines`) with parameterized routes via `matchRoute`. Separate enable/disable endpoints keep the audit log clear about intent (enable vs disable vs general update).

Alternative considered: a toggle endpoint with `{ enabled: true/false }` in the body. Rejected because separate endpoints produce cleaner audit log entries and prevent accidental enable/disable via a mis-sent update body.

### Validate fields at the API layer with detailed error responses

Validation rules:
- `slug`: required, max 80 chars, kebab-case, unique across definitions
- `name`: required, max 120 chars
- `description`: required, max 2000 chars
- `image_slug`: required, max 120 chars
- `badge_slug`: required, max 120 chars, must reference an existing `achievement_definitions.slug` row (validated at save time with a lookup query)
- `duration_days`: required, integer 1-30
- `target_stretch_multiplier`: required, number 1.0-5.0
- `target_min_distance`: required, number > 0, must be < target_max_distance
- `target_max_distance`: required, number > target_min_distance
- `is_repeatable`: boolean, defaults to true
- `enabled`: boolean, defaults to false on create

The API returns `{ error: "validation", fields: { fieldName: "message" } }` for validation failures, which the island renders inline on each field.

Rationale: server-side validation is non-negotiable for admin APIs. Structured field-level errors let the UI show inline validation feedback without custom error parsing.

Alternative considered: client-only validation with server as fallback. Rejected because admin APIs must be robust regardless of client behavior.

### Badge management is inline in the encounter form

The encounter definition form includes a `badge_slug` text field and inline fields for badge name, description, and image slug. The admin can either:
- Enter an existing `achievement_definitions.slug` to link to a badge already created by a migration or another feature.
- Fill in the inline badge fields (name, description, image_slug), which causes the handler to auto-create the achievement definition row on save, using the `badge_slug` as the unique slug.

Rationale: the restructuring plan and shared-achievement-infrastructure design both state that each consuming change manages its own badge definitions. There is no standalone badge admin UI. This inline approach keeps badge management within the encounter form while building reusable patterns — the inline badge field component can be extracted and imported by other admin surfaces (storyline-books-admin, field-guide-discovery-admin) later.

Alternative considered: a full badge CRUD admin page. Rejected as over-scoped — each consuming change only needs to manage its own badges inline.

### Reusable badge definition form component

The inline badge fields (name, description, image_slug) will be implemented as a small reusable Preact component (`BadgeDefinitionFields`) that renders the shared badge metadata inputs. This component is defined in the `AdminEncountersIsland` file but structured so it can be extracted into a shared component later when other admin surfaces need it.

Rationale: the badge definition schema (`achievement_definitions`) is shared. The form fields for editing its metadata (name, description, image_slug) are the same regardless of which feature defines the badge. Building it as a reusable pattern now prevents duplicate implementation later.<｜end▁of▁thinking｜>### Disable confirmation when active occurrences exist

When an admin clicks "disable" on an encounter definition, the API checks for active occurrences referencing that definition. If active occurrences exist, the API returns a count and the UI shows a confirmation modal:
- "X users have active challenges for this encounter. What would you like to do?"
- Option 1: "Keep active challenges" — disable only affects future rolls; active occurrences continue to completion.
- Option 2: "Cancel all active challenges" — disable the definition AND update all active occurrences to status `failed`, then run settlement to finalize them.

If no active occurrences exist, the disable happens immediately without a modal.

Rationale: without this, admins have no way to kill a bugged encounter that users are stuck on. The two-option modal gives admins control while making the consequences of cancellation explicit.

Alternative considered: always leave active occurrences running and let the grace period handle them. Rejected because a definition with a bug (wrong target calculation, wrong duration, wrong badge) needs to be stoppable immediately.

### Image slug field with manual entry

The encounter form has an `image_slug` text field. The admin types an image slug manually. No image browser or uploader is included in this change.

Stretch goal (not required for this change): add an image browser that lists existing images from the asset inventory (`/api/admin/images`), letting admins pick from available images rather than typing slugs blindly. An image upload browser is explicitly NOT in scope — the existing image workflow uses build-time image manifests, not runtime uploads.

Rationale: the existing goal editor has the same manual slug pattern. Adding an image browser is useful but not blocking — it's a separate improvement that benefits all admin surfaces.

### Audit log entries follow the existing pattern

Insert into `admin_audit_log` with: `admin_user_id`, `action` (e.g., `create_encounter`, `update_encounter`, `enable_encounter`, `disable_encounter`), `target_type` = `'personal_encounter'`, `target_id` = definition ID, and `details` as JSON with changed fields.

Rationale: matches how goal mutations, storyline mutations, and user management actions are audited. Consistent audit log format is critical for admin accountability.

### No new D1 migrations

This change reads and writes only the `personal_encounter_definitions` table created by the `personal-challenges` change. No schema changes are needed.

Rationale: the admin layer is a pure API + UI addition on top of existing schema. Keeping it migration-free simplifies the dependency chain.

## Risks / Trade-offs

- [Admin page height with stats + encounter list] → The encounter management section could make the page long. Mitigation: use a collapsible section or place it below the fold — admins scrolling to manage encounters is acceptable.
- [No soft-delete for definitions] → Definitions can be disabled but not deleted. Disabling with active occurrences offers cancellation. Mitigation: follow-on change can add deletion with safety checks.
- [Validation rules may need tuning] → Initial validation bounds are reasonable defaults. Mitigation: rules are in the handler, easily adjusted without schema changes.
- [Badge slug references external table] → `badge_slug` must reference an existing `achievement_definitions` row. Mitigation: validate with a lookup query on save; auto-create the row from inline badge fields if the slug doesn't exist.
- [Active occurrence cancellation may surprise users] → Cancelling active challenges is a destructive admin action. Mitigation: confirmation modal with explicit count of affected users; audit log records the cancellation with the count.

## Open Questions

None. All resolved:
- `badge_slug` column in encounter definitions; admin form manages it inline with reusable badge fields
- Image browser as stretch goal; manual slug entry for now
- Disable confirmation modal with option to cancel active occurrences
- Reusable `BadgeDefinitionFields` component pattern for other admin surfaces
