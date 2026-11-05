## Context

The archived `personal-challenges` change created the `personal_encounter_definitions` table and seeded the Nazgul pursuit, so this change's core dependency is satisfied. This change adds the admin CRUD layer on top of that table and an inline management UI on the existing `/admin` dashboard page.

The admin page already renders `AdminDashboardIsland` (stats) inside an SSR shell from `renderAdminPage.ts`. The shell also contains navigation links to other admin sections (goals, storylines, users, metrics). This change adds a second island below the dashboard stats.

The existing pattern for admin CRUD follows:
- Handlers in domain-specific files (e.g., `encounter-admin-handlers.ts`) with `handleAdminXxx` naming
- Routes guarded by `adminGuard` in `src/index.ts`; guarded handlers receive `adminUserId` for audit logging
- Audit logging through `logAdminAction` from `src/admin-shared.ts` on mutation actions
- Preact islands registered in `client/src/index.tsx` and hydrated via `data-island` attributes

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
- No storyline, route-segment, or cooldown template eligibility rules. The schema for those rules is not present in `personal_encounter_definitions`; they remain deferred to a separate schema-bearing change. This change manages globally eligible definitions only.
- No image browser or uploader; this change uses manual image slug entry.

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

Rationale: matches the existing admin API pattern (`/api/admin/goals`, `/api/admin/storylines`) with Hono parameterized routes guarded by `adminGuard`. Separate enable/disable endpoints keep the audit log clear about intent (enable vs disable vs general update).

Alternative considered: a toggle endpoint with `{ enabled: true/false }` in the body. Rejected because separate endpoints produce cleaner audit log entries and prevent accidental enable/disable via a mis-sent update body.

### Validate fields at the API layer with detailed error responses

Validation rules:
- `slug`: required, max 80 chars, kebab-case, unique across definitions
- `name`: required, max 120 chars
- `description`: required, max 2000 chars
- `image_slug`: required, max 120 chars
- `badge_slug`: required, max 120 chars, kebab-case; if no `achievement_definitions.slug` row matches, `badge_name`, `badge_description`, and `badge_image_slug` are required so the handler can create the definition
- `duration_days`: required, integer 1-30
- `target_stretch_multiplier`: required, number 1.0-5.0
- `target_min_distance`: required, number > 0, must be <= target_max_distance
- `target_max_distance`: required, number >= target_min_distance
- `is_repeatable`: boolean, defaults to true
- `enabled`: boolean, defaults to false on create; the insert must explicitly store false rather than rely on the schema default

The API returns `{ error: "validation", fields: { fieldName: "message" } }` for validation failures, which the island renders inline on each field.

Rationale: server-side validation is non-negotiable for admin APIs. Structured field-level errors let the UI show inline validation feedback without custom error parsing. Equal target bracket endpoints are supported by the schema and challenge engine.

Alternative considered: client-only validation with server as fallback. Rejected because admin APIs must be robust regardless of client behavior.

### Badge management is inline in the encounter form

The encounter definition form includes a `badge_slug` text field and inline fields for badge name, description, and image slug. The admin can either:
- Enter an existing `achievement_definitions.slug` to link to a badge already created by a migration or another feature.
- Fill in the inline badge fields (name, description, image_slug), which causes the handler to auto-create the achievement definition row on save, using the `badge_slug` as the unique slug.

Auto-created rows use `badge_type='challenge'`, inherit the encounter's `is_repeatable` value, and include the shared personal-encounter metadata convention: `storyline: null`, `rank_thresholds` (`[1]` for non-repeatable badges and `[1,3,7,15]` for repeatable badges), `unit: 'completions'`, and `criteria: 'personal_encounter_completed'`.

Rationale: the restructuring plan and shared-achievement-infrastructure design both state that each consuming change manages its own badge definitions. There is no standalone badge admin UI. This inline approach keeps badge management within the encounter form while building reusable patterns — the inline badge field component can be extracted and imported by other admin surfaces (storyline-books-admin, field-guide-collectible-discovery-admin) later.

Alternative considered: a full badge CRUD admin page. Rejected as over-scoped — each consuming change only needs to manage its own badges inline.

### Reusable badge definition form component

The inline badge fields (name, description, image_slug) will be implemented as a small reusable Preact component (`BadgeDefinitionFields`) that renders the shared badge metadata inputs. This component is defined in the `AdminEncountersIsland` file but structured so it can be extracted into a shared component later when other admin surfaces need it.

Rationale: the badge definition schema (`achievement_definitions`) is shared. The form fields for editing its metadata (name, description, image_slug) are the same regardless of which feature defines the badge. Building it as a reusable pattern now prevents duplicate implementation later.

### Disable confirmation when active occurrences exist
When an admin clicks "disable" on an encounter definition, the API checks for active occurrences referencing that definition. If active occurrences exist, the API returns a count and the UI shows a confirmation modal:
- "X users have active challenges for this encounter. What would you like to do?"
- Option 1: "Keep active challenges" — disable only affects future rolls; active occurrences continue to completion.
- Option 2: "Cancel all active challenges" — disable the definition AND set active occurrences to `status='failed', updated_at=CURRENT_TIMESTAMP`. No badge is awarded and no settlement pass is required; the occurrence schema has no separate `cancelled` state.

If no active occurrences exist, the disable happens immediately without a modal.

Rationale: without this, admins have no way to kill a bugged encounter that users are stuck on. The two-option modal gives admins control while making the consequences of cancellation explicit.

Alternative considered: always leave active occurrences running and let the grace period handle them. Rejected because a definition with a bug (wrong target calculation, wrong duration, wrong badge) needs to be stoppable immediately.

### Image slug field with manual entry

The encounter form has an `image_slug` text field. The admin types an image slug manually. No image browser or uploader is included in this change.

Rationale: the existing goal editor has the same manual slug pattern. Adding an image browser is useful but not blocking — it's a separate improvement that benefits all admin surfaces.

### Audit log entries follow the existing pattern

Call `logAdminAction` with `adminUserId`, `action` (`create_encounter`, `update_encounter`, `enable_encounter`, `disable_encounter`, or `cancel_active_occurrences`), `targetType='personal_encounter'`, `targetId` = definition ID, `details` as JSON with changed fields and active occurrence counts, `ipAddress`, and `success: true`.

Rationale: matches how goal mutations, storyline mutations, and user management actions are audited. Consistent audit log format is critical for admin accountability.

### No new D1 migrations

This change reads and writes only the `personal_encounter_definitions` table created by the `personal-challenges` change. No schema changes are needed.

Rationale: the admin layer is a pure API + UI addition on top of existing schema. Keeping it migration-free simplifies the dependency chain.

## Risks / Trade-offs

- [Admin page height with stats + encounter list] → The encounter management section could make the page long. Mitigation: use a collapsible section or place it below the fold — admins scrolling to manage encounters is acceptable.
- [No soft-delete for definitions] → Definitions can be disabled but not deleted. Disabling with active occurrences offers cancellation. Mitigation: follow-on change can add deletion with safety checks.
- [Validation rules may need tuning] → Initial validation bounds are reasonable defaults. Mitigation: rules are in the handler, easily adjusted without schema changes.
- [Badge slug references external table] → `badge_slug` can link to an existing `achievement_definitions` row or create one from inline fields. Mitigation: validate slug format and require complete inline fields before insertion.
- [Badge slug reassignment may orphan the prior definition] → Changing an encounter's badge slug can leave the previous achievement definition unused, but earned achievements still reference its history. Mitigation: never delete the old definition during encounter edits; leave it available for historical display.
- [Manual artwork slugs may not resolve] → Encounter and badge image slugs can name assets absent from the build-time manifest. Mitigation: surface the existing admin image inventory as a future shared picker; this change preserves the established manual-entry behavior.
- [Active occurrence cancellation may surprise users] → Cancelling active challenges is a destructive admin action. Mitigation: confirmation modal with explicit count of affected users; audit log records the cancellation with the count.

## Migration Plan

1. Create `src/encounter-admin-handlers.ts` with list/create/get/update/enable/disable handlers.
2. Register Hono routes in `src/index.ts` beside the existing admin routes, all behind `adminGuard`.
3. Create `AdminEncountersIsland` and register it in `client/src/index.tsx` (`autoHydratedIslands`, `allIslands`).
4. Add the island mount to `renderAdminPage.ts` and styles to `public/css/admin.css`.
5. Add Jest, Vitest, and Playwright smoke coverage, then update the API documentation.

Rollback: remove the island mount, both registry entries, route registrations, handler file, CSS, and tests. No schema or data needs to be reverted; definitions an admin created can simply be disabled.

## Open Questions

None. All resolved:
- `badge_slug` column in encounter definitions; admin form manages it inline with reusable badge fields
- Image browser is a non-goal; manual slug entry for this change
- Disable confirmation modal with option to cancel active occurrences
- Reusable `BadgeDefinitionFields` component pattern for other admin surfaces
- Template eligibility rules require a separate schema-bearing change
