## Context

Walk to Mordor is a Cloudflare Workers monolith backed by D1. The codebase has no existing achievement or badge infrastructure. Three planned features — personal challenges, storyline books, and the Field Guide — all need to award durable badges that persist through walk edits and deletes, support both one-time and repeatable awards, and display aggregated repeat counts on profile surfaces.

This design defines the shared data model and domain service that all three features will consume through the same path, avoiding three parallel implementations of the same badge pattern.

The app already uses an `admin_audit_log` table for append-only records and follows a pattern of strict TypeScript interfaces for all D1 result rows. The achievement service extends that pattern rather than inventing a new one.

## Goals / Non-Goals

**Goals:**
- Provide one `achievement_definitions` table so any feature can register badge metadata without creating its own definition table.
- Provide one append-only `user_achievement_instances` table with idempotency-key uniqueness so features can request awards safely from progress hooks and reconciliation flows.
- Expose a domain service (`awardAchievement`, `getUserAchievements`, `getUserAchievementSummary`) that consolidates idempotency, immutability, and repeat-count aggregation in one place.
- Keep TypeScript interfaces strict with no `any` and explicit D1 result shapes.
- Keep the service testable in isolation with Jest coverage for award idempotency, repeat-count grouping, and the guarantee that nothing ever deletes or mutates an earned instance.

**Non-Goals:**
- No standalone API endpoints. Badge data is surfaced through existing session/profile endpoints by consuming changes.
- No badge display UI. That belongs to the separate `profile-badge-display` change.
- No badge-definition admin management UI. Each consuming change manages its own badge definitions through its own admin surface.
- No automatic badge awarding. The service provides `awardAchievement()`; consuming changes decide when to call it.

## Decisions

### Use two normalized tables rather than a denormalized single table

`achievement_definitions` stores badge metadata once per badge type. `user_achievement_instances` stores earned records, one row per award event.

Rationale: badge names, descriptions, images, and repeatability rules belong to the definition. Earned instances carry user, timestamp, idempotency key, and optional per-occurrence context. Separating them avoids duplicating badge metadata across every earned row and makes definition-level queries (e.g., "what badges exist for books?") trivial.

Alternative considered: a single table with badge metadata repeated on every earned row. Rejected because it makes definition management harder, wastes storage, and makes metadata consistency fragile.

### Derive repeat counts through aggregation, not a mutable counter

The `getUserAchievementSummary` method groups instances by `achievement_id` and returns a count. There is no `earned_count` column to increment.

Rationale: the instances table is append-only and immutable. A mutable counter would need transactional increment/decrement logic and would drift from the actual instance rows. Aggregation is always correct by construction.

Alternative considered: a mutable `earned_count` column on a user-achievement summary row. Rejected because it introduces a second source of truth that can diverge from the instances table.

### Use a composite idempotency key rather than a surrogate

`user_achievement_instances` will have a `UNIQUE(user_id, achievement_id, idempotency_key)` constraint. Consuming changes provide a meaningful key (e.g., `book_attempt:<attempt_id>` or `encounter_occurrence:<occurrence_id>`).

Rationale: idempotency is domain-meaningful. A surrogate UUID would allow the same logical award to be requested twice with different keys. The consuming change knows what constitutes a duplicate award — the service just enforces it.

Alternative considered: a single `UNIQUE(user_id, achievement_id)` constraint with a `count` increment instead of multiple rows. Rejected because it loses per-occurrence context metadata and makes "which specific book attempt earned this badge?" unanswerable.

### Make definitions referenceable by a stable string slug

`achievement_definitions.slug` will be a unique, human-readable identifier like `nazgul-outrun`, `book-fellowship-1-complete`, or `field-guide-hollin-complete`. Consuming changes reference definitions by slug when calling `awardAchievement`.

Rationale: slugs are stable across environments, readable in logs and audit trails, and avoid numeric ID coupling between migration-authored definitions and runtime code.

Alternative considered: using auto-increment integer IDs and exporting constants. Rejected because it makes cross-environment testing and migration coordination harder.

### Return `{ instanceId, isNew }` from awardAchievement

`awardAchievement` will return `{ instanceId: number; isNew: boolean }`. On first award, `isNew` is `true` and `instanceId` is the newly inserted row ID. On duplicate (same idempotency key), `isNew` is `false` and `instanceId` is the existing row ID.

Rationale: callers need to decide whether to fire a toast notification ("Badge earned!") or silently continue. The `isNew` flag lets them branch without a separate existence check.

Alternative considered: returning void and requiring callers to pre-check. Rejected because it creates a race condition and doubles the writes in the common case.

### Throw on missing achievement slug

`awardAchievement` will throw an `AchievementDefinitionNotFoundError` if the supplied slug does not match any row in `achievement_definitions`. This is a programmer error — a consuming change shipped a badge award for a slug that was never seeded — and should fail loudly in tests.

Rationale: silently swallowing a missing slug would cause badges to fail to award with no observable error, creating invisible data loss that could persist for releases.

Alternative considered: returning `null` or `{ isNew: false, instanceId: 0 }`. Rejected because it masks bugs.

### Enforce `is_repeatable` in the award service

`awardAchievement` will check the definition's `is_repeatable` flag. For non-repeatable badges, the caller-supplied idempotency key is ignored for storage purposes and replaced with a fixed sentinel (`NON_REPEATABLE_IDEMPOTENCY_KEY`) before the pre-insert lookup and the insert itself. This makes the single `UNIQUE(user_id, achievement_id, idempotency_key)` constraint behave as `UNIQUE(user_id, achievement_id)` for non-repeatable rows, so the database -- not just the pre-insert SELECT -- rejects a second award even if two concurrent requests race each other using different caller-supplied keys. If the user already has any earned instance, the service returns `{ instanceId: existingId, isNew: false }` without inserting a new row.

Rationale: leaving `is_repeatable` as a display-only hint would allow a buggy caller to award a one-time badge multiple times with different idempotency keys. The service should enforce the intended behavior at the database level, not just via an app-level pre-check that a race could slip past.

Alternative considered: letting a separate `UNIQUE(user_id, achievement_id)` constraint enforce it for non-repeatable badges. Rejected because it would require two different table schemas depending on repeatability, making the model harder to evolve. The sentinel-key approach gets the same database-enforced guarantee from the single existing constraint.

### Store per-occurrence context as JSON metadata

`user_achievement_instances.context_metadata` will be a TEXT column holding JSON with occurrence-specific data (e.g., storyline name, book title, encounter occurrence ID, distance at award time).

Rationale: different achievement types carry different context. A structured JSON column lets the service remain generic while preserving domain-specific details for display and audit purposes, without requiring type-specific columns on the instances table.

Alternative considered: separate instance tables per achievement type. Rejected because it would fragment the shared model and make profile-level "show all badges" queries cross-table unions.

### Keep the service synchronous and call it from existing hooks

`awardAchievement` will be called inline from progress hooks, scheduled settlement, and API handlers. No queuing, no background processing.

Rationale: award insertion is a single-row D1 write. The service is called at most once per progress write or settlement tick per active event/book. This is not a hot path and does not need async decoupling.

Alternative considered: queuing awards through `ctx.waitUntil`. Rejected as premature complexity for a write that is already idempotent and safe to retry.

### Do not create a separate Worker module or route for achievements

The achievement domain service will be a plain TypeScript module at `src/achievement-utils.ts`, following the existing codebase convention (`auth-utils.ts`, `email-utils.ts`, `storyline-utils.ts`). Consuming features import and call its functions directly.

Rationale: achievements are not a standalone API surface. They are a library consumed by other handlers. Adding routes or a dedicated module boundary would add indirection without benefit. The `-utils` naming matches the established pattern for shared domain helpers.

### Achievement summary is exposed through a dedicated endpoint, not session

The `getUserAchievementSummary` function is provided by this change, but the endpoint that exposes it (`GET /api/achievements`) belongs to the `profile-badge-display` change. This change is a pure data layer + domain service — it has no API routes.

Rationale: achievements are profile display objects, not session auth objects. A dedicated endpoint keeps the session response focused on identity and preferences while letting the profile UI fetch badges independently. The consuming `profile-badge-display` change owns both the endpoint and the badge grid UI.

## Risks / Trade-offs

- [Migration numbering conflicts across changes] → Three changes need achievement tables, but only this one creates them. Consuming changes must coordinate migration numbering so their badge-definition seeds and award calls run after this change's migrations. Mitigation: document the dependency in each consuming change's proposal and use migration file naming conventions that make ordering clear.
- [JSON metadata queries are limited in SQLite] → D1 SQLite supports `json_extract` but not rich JSON indexing. Mitigation: context metadata is read-only for display purposes; all queryable fields (user_id, achievement_id, earned_at) are in indexed columns.
- [Badge definition slugs must be unique across features] → A naming convention is needed to prevent slug collisions between features. Mitigation: recommend a slug prefix convention (`book-*`, `challenge-*`, `field-guide-*`) and document it in the consuming change proposals.
- [No cascading delete or update for definitions] → If a consuming change later removes a badge definition, orphaned instances remain. Mitigation: instances are append-only by design. Removing a definition should be a soft-delete or a migration that also archives instances. Document this constraint.

## Migration Plan

1. Add a D1 migration for `achievement_definitions` with slug, name, description, image_slug, badge_type, is_repeatable, and metadata columns, plus a unique index on slug.
2. Add a D1 migration for `user_achievement_instances` with user_id, achievement_id, earned_at, context_metadata, and idempotency_key columns, plus indexes for user-scoped lookups and the `UNIQUE(user_id, achievement_id, idempotency_key)` constraint.
3. Add TypeScript interfaces and the domain service module.
4. Add Jest coverage for idempotent award, repeat-count aggregation, and the immutability guarantee.
5. Update `docs/data-models.md` with the achievement schema.

Rollback strategy: both tables are additive. If the service needs to be rolled back, consuming changes stop calling `awardAchievement` and the tables sit unused. Existing earned instances are preserved and can be re-consumed when the service is re-enabled.

## Open Questions

None. All design decisions are resolved:
- Module location: `src/achievement-utils.ts`
- `badge_type`: free-form string, defined by consuming changes
- `awardAchievement` return type: `{ instanceId: number; isNew: boolean }`
- Missing slug behavior: throws `AchievementDefinitionNotFoundError`
- `is_repeatable` enforcement: checked in `awardAchievement`, non-repeatable badges blocked on second award
- Achievement summary endpoint: owned by `profile-badge-display` change via `GET /api/achievements`
