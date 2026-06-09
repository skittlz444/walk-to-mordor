# OpenSpec Change Restructuring Plan

> Generated 2026-06-09. This document is the canonical reference for how the 5 original changes are restructured into 14 atomic changes with clear dependency ordering.

---

## Original State → Restructured State

| # | Original Change | Tasks | Disposition |
|---|----------------|-------|-------------|
| 1 | `events-and-challenges` | 53 | **Archive** — split into 5 new changes |
| 2 | `storyline-books-and-achievements` | 69 | **Archive** — split into 4 new changes |
| 3 | `field-guide-collectible-discovery` | 26 | **Split** — core + admin |
| 4 | `goal-milestone-journals` | 16 | **Keep** — already atomic |
| 5 | `goal-content-campfire-lore` | 18 | **Keep** — already atomic |

**Total: 5 → 14 changes**

---

## Full Change Inventory

### PHASE 1 — No Dependencies (Parallel)

These two changes have no dependencies on each other or any other change. They can be implemented in parallel or sequentially.

---

#### Change: `goal-milestone-journals`
- **Status**: ✅ Keep as-is
- **Tasks**: ~16
- **Depends on**: nothing

**Scope**: Plain-text milestone journal entries stored once per user per canonical goal, shared across all storylines. GoalModal is the only MVP journal surface.

**What it includes:**
- D1: `milestone_journals` table with `(user_id, goal_id)` uniqueness
- APIs: `GET /api/goals/:goalId/journals`, `PUT /api/goals/:goalId/journal`, `DELETE /api/goals/:goalId/journal`
- Access rules: personal reach checks, fellowship-context write validation, friend-read gating
- UI: GoalModal journal authoring (2000-char, visibility selector, safe plain-text rendering)
- No standalone `/journals` page in MVP

---

#### Change: `goal-content-campfire-lore`
- **Status**: ✅ Keep as-is
- **Tasks**: ~18
- **Depends on**: nothing

**Scope**: Authored rich content (stories, poetry, appendices) attached directly to goals, with admin authoring inside existing goal editor.

**What it includes:**
- D1: `goal_content` table + `content_discovery_events` table
- APIs: Admin goal-content CRUD, public goal-content read (reuses goal unlock semantics)
- `/api/goals` extends to include `has_content`
- UI: GoalModal content presentation (type-aware rendering, appendix truncation)
- Admin: inline content authoring in `AdminGoalEditIsland`
- Discovery analytics (best-effort, non-blocking)
- Includes admin authoring UI — no separate admin change needed

---

### PHASE 2 — Achievement Foundation

These two changes build the shared badge infrastructure and the profile display. Both must land before any change that awards badges.

---

#### Change: `shared-achievement-infrastructure` ★ NEW
- **Tasks**: ~8
- **Depends on**: nothing

**Scope**: Foundation data layer + domain service for achievements. No UI, no standalone API endpoints.

**What it includes:**
- D1 migration: `achievement_definitions` table (slug, name, description, image_slug, badge_type, is_repeatable, metadata)
- D1 migration: `user_achievement_instances` table (user_id, achievement_id, earned_at, context_metadata, idempotency_key)
- TypeScript interfaces: `AchievementDefinition`, `UserAchievementInstance`, `AchievementSummary` (with aggregation count)
- Domain service: `awardAchievement()`, `getUserAchievements()`, `getUserAchievementSummary()` (groups repeatable badges with counts)
- Jest coverage for idempotency, repeat-count aggregation, and immutability

**What it does NOT include:**
- Badge display on profiles (next change)
- Admin management UI (badge definitions are created by consuming changes)
- Any domain-specific achievement types (events, books, field guide define their own badge definitions)

**Why it's atomic**: Purely a data layer + domain service. No user-visible surface. Each consuming change wires badge display into its own UI.

---

#### Change: `profile-badge-display` ★ NEW
- **Tasks**: ~6
- **Depends on**: `shared-achievement-infrastructure`

**Scope**: Badge grid on profile and friend profile surfaces. Renders whatever badges exist — no domain awareness of where they came from.

**What it includes:**
- `GET /api/achievements` endpoint: returns the authenticated user's achievement summary via `getUserAchievementSummary()`
- Badge grid component (image, name, repeat count where > 1)
- Profile page integration: fetches from `GET /api/achievements`
- Friend profile integration: fetches achievements from friend profile endpoint
- Empty state: gracefully shows nothing when user has no badges
- CSS: focused badge grid styles (no unrelated selector contamination)
- Vitest coverage: badge rendering, repeat counts, empty state

**What it does NOT include:**
- Badge award logic (in shared infra + consuming changes)
- Badge definition management (in consuming changes that define them)
- Any domain-specific badge types

**Why it's atomic**: Standalone UI surface. Once built, any change that awards badges automatically gets profile visibility.

---

### PHASE 3 — Personal Challenges (YOUR PRIORITY)

These two changes implement the personal encounter system, starting with the Nazgul pursuit.

---

#### Change: `personal-challenges` ★ NEW
- **Tasks**: ~20
- **Depends on**: `shared-achievement-infrastructure`, `profile-badge-display`

**Scope**: End-to-end personal encounter loop — daily roll → encounter popup → accept → progress → complete → badge. Nazgul pursuit is the only seeded encounter.

**What it includes:**

| Section | Tasks | Content |
|---------|-------|---------|
| Schema | 4 | Progress `created_at`/`updated_at` migration; `personal_encounter_definitions`, `encounter_occurrences`, `daily_rolls`, `event_participants`, `event_progress_ledger` tables + indexes; Nazgul pursuit encounter definition seed + Nazgul badge definition |
| Domain | 5 | TypeScript interfaces; eligibility evaluation (Nazgul = globally eligible: all storylines, all distances); daily roll logic (1-in-10 / 1-in-30 branches, activity-gated, idempotent); personalized target calculation from active-day averages with template stretch and min/max bracketing; participant creation for accepted challenges; badge awarding via shared infra |
| APIs | 4 | `POST /api/events/daily-roll`; `POST /api/events/daily-roll/accept`; `POST /api/events/daily-roll/decline`; `GET /api/events/mine` (active + past personal challenges) |
| Progress | 5 | Reconciliation service (ledger-backed, cached totals); create/update/delete hooks on calendar progress; pre-join exclusion; ledger idempotency; Jest coverage |
| Scheduled | 3 | Personal challenge expiry/failure settlement; wire into `scheduled()` handler with independent error isolation; Jest coverage |
| UI | 4 | Encounter popup island (journey + map pages); Nazgul themed copy, accept/decline actions; focused CSS |
| Docs | 2 | Update `docs/data-models.md` and `docs/api-reference.md` for personal challenges |

**What it does NOT include:**
- Community campaigns (separate change, separate tables)
- Admin encounter definition management UI (next change)
- Public `/events` page (that's community campaigns)
- Storyline/route-segment-specific eligibility (Nazgul is globally eligible)
- More than one encounter definition (just Nazgul seeded)

**Why it's atomic**: A user can experience the complete Nazgul encounter loop — roll → encounter popup → accept → walk → progress → complete → earn badge → see badge on profile. Seed via migration, no admin UI dependency.

---

#### Change: `personal-challenges-admin` ★ NEW
- **Tasks**: ~8
- **Depends on**: `personal-challenges`

**Scope**: Admin management UI for personal encounter definitions. Makes new encounters creatable without code changes.

**What it includes:**
- Admin APIs: encounter definition CRUD (list, create, update, enable/disable, inspect)
- Admin UI: `AdminPersonalEncountersIsland` — management of encounter copy, image, eligible storylines, path-distance brackets, enabled state, duration, target min/max bracketing, badge metadata
- Admin audit logging for encounter definition changes
- Jest + Vitest coverage

**What it does NOT include:**
- Community campaign management (separate change)
- User-facing encounter surfaces (in personal-challenges)

**Why it's atomic**: Once landed, admins can create new encounters (Moria chase, Minas Tirith defense, etc.) without code changes. Follow-on changes can add more admin features (bulk operations, analytics, etc.).

---

### PHASE 4 — Community Campaigns

These two changes implement the public community campaign system. Community campaigns use completely separate tables from personal challenges — the shared ground ("timed events") is too thin to justify a unified schema when their query patterns, visibility rules, lifecycle, and participant mechanics differ so much.

---

#### Change: `community-campaigns` ★ NEW
- **Tasks**: ~20
- **Depends on**: `shared-achievement-infrastructure`, `profile-badge-display`

**Scope**: Public community campaigns with opt-in participation, public progress tracking, and ranked contributor display.

**What it includes:**

| Section | Tasks | Content |
|---------|-------|---------|
| Schema | 3 | `campaign_definitions`, `campaign_participants`, `campaign_progress_ledger` tables + indexes (separate from personal challenge tables) |
| Domain | 4 | TypeScript interfaces; participant creation; progress reconciliation (same ledger pattern, own tables); badge awarding via shared infra |
| APIs | 5 | Admin campaign CRUD + metric suggestion endpoints; Public (auth-free): `GET /api/events`, `GET /api/events/:id`, `GET /api/events/:id/community-progress`; Authenticated: `POST /api/events/:id/join` |
| Progress | 4 | Reconciliation hooks on calendar progress create/update/delete; post-join credit only; ledger idempotency; Jest coverage |
| Scheduled | 3 | Campaign lifecycle settlement (upcoming→active, active→completed/expired based on outcome rules); wire into `scheduled()`; Jest coverage |
| UI | 4 | Public `/events` page SSR shell + Preact island; event list/detail; community progress with ranked contributor distances; personal contribution display |
| Docs | 2 | Update docs for community campaigns |

**What it does NOT include:**
- Personal challenges (separate change, separate tables)
- Admin campaign management UI (next change)
- Daily roll or personalized targets (not applicable to community campaigns)
- Storyline/path-specific eligibility (campaigns are global)

**Why it's atomic**: Admins can create campaigns (via API, seeded, or admin UI change), users can discover them publicly, join, contribute, and see community progress. Badges appear on profiles via the already-built profile-badge-display.

**Key differences from personal challenges:**

| Aspect | Personal Challenges | Community Campaigns |
|--------|--------------------|--------------------|
| Trigger | Random daily roll | Admin-created, scheduled |
| Visibility | Private (per user) | Public to all |
| Participation | Accept/decline one user | Join (no decline), multi-user |
| Targets | Personalized from activity | Fixed community target |
| Progress | Private | Public with contributor rankings |
| Eligibility | Activity-gated, can be storyline/path-specific | Global, all users |
| Cooldowns | Yes (1-in-10 vs 1-in-30 branches) | No cooldowns |
| Page | Encounter popup only | Public `/events` page |

---

#### Change: `community-campaigns-admin` ★ NEW
- **Tasks**: ~8
- **Depends on**: `community-campaigns`

**Scope**: Admin management UI for community campaigns.

**What it includes:**
- Admin UI: `AdminCommunityCampaignsIsland` — create/edit campaigns with suggested target/duration values from recent community walking metrics
- Campaign management: enable/disable, visibility controls
- Community metric suggestion logic (target distance, duration, expected opt-in, safety margin assumptions)
- Admin audit logging for campaign creation and updates
- Jest + Vitest coverage

**What it does NOT include:**
- Personal encounter definition management (separate change)
- User-facing campaign surfaces (in community-campaigns)

---

### PHASE 5 — Storyline Books

The original `storyline-books-and-achievements` (69 tasks) split into 3 changes. The Core/UI split works because:

- **Core API responses are additive**: New fields (`activeBookId`, `bookProgress`, `bookLength`) appear alongside existing fields. Clients that don't read them ignore them. No existing code path breaks.
- **Default behavior preserves whole-story mode**: Until UI explicitly requests book-view mode, all surfaces behave identically to before.
- **Badges appear progressively**: Core awards book completion badges via shared infra. Badges immediately appear on profiles via `profile-badge-display` (already built in Phase 2). This creates anticipation for the book UI.
- **Migration is idempotent**: Attempt-scoped awards prevent double-badging on re-deploy.

---

#### Change: `storyline-books-core` ★ NEW
- **Tasks**: ~35
- **Depends on**: `shared-achievement-infrastructure`, `profile-badge-display`

**Scope**: Backend infrastructure for storyline book segments. All APIs work, badges award, but UI stays in whole-story mode.

**What it includes:**

| Section | Tasks | Content |
|---------|-------|---------|
| Schema | 6 | `storyline_books` table (storyline ownership, ordered metadata, start/end distances, optional boundary goal anchors, badge metadata, timestamps, indexes); active user/party book state tables; personal/fellowship book attempt tables; fellowship book contribution tracking table |
| Seeds | 3 | Six book splits + badge metadata for Frodo/Sam storyline; Six book splits + badge metadata for Pippin storyline; Fallback full-journey books for other public active storylines |
| Migration | 3 | One-time user backfill: active book inference from current story distance, completed personal book achievement awards; One-time fellowship backfill: active book inference + contributor-eligible fellowship achievements; Idempotency guarantees |
| Domain | 10 | TypeScript interfaces; book progress math (whole-story distance, book progress, book length, relative milestone distance, clamp); active-book inference (next-book-at-boundary, final-book handling); public storyline book coverage validation (gaps, overlaps, out-of-range); admin draft validation (reports problems without blocking saves); user book switch planning (reset, carry, disabled carry); party book switch planning (leader-controlled); personal book attempt creation/superseding/completion detection/award idempotency; fellowship book attempt creation/superseding/contribution tracking/completion detection/contributor award idempotency; Jest coverage |
| APIs | 7 | Extend `/api/session` with active book context; Extend `/api/total-distance` with book progress, book length, active book metadata; Extend `/api/goals` with current-book milestone filtering (when viewMode=book); Authenticated book switch endpoint (reset/carry); Leader-only fellowship book switch endpoint; Admin storyline book APIs (CRUD, validation, inspect); Public activation validation enforcement |
| Progress hooks | 5 | Personal book completion detection on progress create/update/delete; Fellowship book completion detection on party progress updates; Immutable awards (edits/deletes never revoke); No double-awarding on edit loops; Departed member exclusion from future fellowship eligibility |
| Book badge definitions | 2 | Create acevemen definitions for personal and fellowship book completions via shared infra; Aggregate repeated completions for display |

**What it does NOT include:**
- Any UI changes (user-facing or admin)
- Achievement table creation or domain service (uses shared infra)

---

#### Change: `storyline-books-ui`
- **Tasks**: ~15
- **Depends on**: `storyline-books-core`

**Scope**: All user-facing book UI. Makes books visible and interactive.

**What it includes:**
- Onboarding: starting book selection for new users
- Profile: active book display, book switch controls (reset/carry), disabled carry explanations
- Party management: leader book switching controls
- Journey: current-book vs whole-story view mode toggle, relative distance display
- Map: milestone filtering to active book (current-book view); friend/fellowship markers kept globally visible with whole-story distance in labels
- View mode persistence (same scope as current personal/fellowship view selection)
- Legacy goals rendering integration (book-filtered goals without rewriting legacy code)
- Vitest coverage

---

#### Change: `storyline-books-admin`
- **Tasks**: ~10
- **Depends on**: `storyline-books-core`

**Scope**: Admin management UI for storyline books.

**What it includes:**
- Extend `AdminStorylinesIsland` with book CRUD (create, edit, reorder, delete)
- Milestone-anchor boundary pickers (distances as source of truth)
- Inline coverage validation summaries (gaps, overlaps, shared endpoints, out-of-range)
- Badge metadata fields (name, image slug, repeatability, description)
- Admin audit logging for book mutations
- Vitest coverage

---

### PHASE 6 — Field Guide

---

#### Change: `field-guide-collectible-discovery-core`
- **Tasks**: ~18
- **Depends on**: `shared-achievement-infrastructure`

**Scope**: Full Field Guide experience — regions, collectibles, discovery engine, collection UI. Badge definitions reference the shared schema for forward compatibility but do not award badges in MVP.

**What it includes:**

| Section | Tasks | Content |
|---------|-------|---------|
| Schema | 3 | `field_guide_regions`, `storyline_region_mappings`, `collectible_definitions`, `discovery_high_water`, `user_discovery_instances`, `user_unread_state` tables + indexes |
| Seeds | 1 | Initial flora/fauna regions, storyline mappings, and collectible catalog entries |
| Domain | 4 | TypeScript interfaces; region/collectible validation (slugs, categories, rarity tiers, slot ordering, non-overlapping mappings); discovery engine (positive-delta budget, rarity-tier odds, long-walk rare bump, per-date high-water farming prevention); immutable discovery instances |
| APIs | 3 | Public Field Guide list/detail/status endpoints; Unread-state and mark-seen endpoints (server-backed); Public map-marker data for first discoveries (path-filtered) |
| Progress hooks | 2 | Extend walk create/update flows for discovery evaluation from positive deltas; Isolate Field Guide processing from primary walk save failures |
| UI | 5 | `/field-guide` SSR shell + Preact island; Region sections in fixed slot order, silhouettes visible from start, discovered entries revealed; Duplicate counts, flora/fauna filters; Drawer navigation badge (first discoveries + duplicates); Konva first-discovery marker layer (compatible-path filtering); Dev-mode region band overlays (`window.__MAP_DEV_LOG`) |
| Docs | 2 | Update docs |

**What it does NOT include:**
- Admin management UI (next change)
- Duplicate-threshold achievement awarding (deferred from MVP)
- Social sharing or showcasing (deferred from MVP)
- Non-flora/fauna categories (deferred from MVP)

---

#### Change: `field-guide-collectible-discovery-admin` ★ NEW
- **Tasks**: ~8
- **Depends on**: `field-guide-collectible-discovery-core`

**Scope**: Admin management UI for Field Guide regions, storyline mappings, and collectible catalog.

**What it includes:**
- Admin region CRUD API + management surface
- Storyline-region mapping controls with gap/overlap validation
- Admin collectible CRUD API + management surface (category, rarity tier, slot order, illustrations, lore content)
- Content preview and illustration selection workflow
- Separately administered from storyline admin (dedicated Field Guide admin section)
- Vitest coverage

---

### FUTURE — Not Yet Scoped

#### `community-campaign-notifications`
- New push notification category: notify subscribed users when a new community campaign is created or when a campaign reaches completion
- Uses existing push notification infrastructure
- To be scoped after community campaigns are implemented

---

## Complete Dependency Graph

```
PHASE 1 (parallel, no deps):
  goal-milestone-journals ───────────────────── 16 tasks
  goal-content-campfire-lore ────────────────── 18 tasks

PHASE 2 (foundation):
  shared-achievement-infrastructure ──────────── 8 tasks
        │
  profile-badge-display ──────────────────────── 6 tasks

PHASE 3 (your priority):
        │
  personal-challenges ───────────────────────── 20 tasks
        │
  personal-challenges-admin ──────────────────── 8 tasks

PHASE 4 (community):
        │
  community-campaigns ───────────────────────── 20 tasks
        │
  community-campaigns-admin ──────────────────── 8 tasks

PHASE 5 (storyline books):
        │
  storyline-books-core ──────────────────────── 35 tasks
        ├── storyline-books-ui ──────────────── 15 tasks
        └── storyline-books-admin ───────────── 10 tasks

PHASE 6 (field guide):
        │
  field-guide-collectible-discovery-core ────── 18 tasks
        │
  field-guide-collectible-discovery-admin ────── 8 tasks

FUTURE:
  community-campaign-notifications ──────────── (not scoped)
```

---

## Implementation Sequence (Recommended Order)

```
 1. goal-milestone-journals                 16 tasks   Phase 1
 2. goal-content-campfire-lore              18 tasks   Phase 1
────────────────────────────────────────────────────
 3. shared-achievement-infrastructure        8 tasks   Phase 2
 4. profile-badge-display                    6 tasks   Phase 2
────────────────────────────────────────────────────
 5. personal-challenges                     20 tasks   Phase 3 ★ YOUR PRIORITY
 6. personal-challenges-admin                8 tasks   Phase 3
────────────────────────────────────────────────────
 7. community-campaigns                     20 tasks   Phase 4
 8. community-campaigns-admin                8 tasks   Phase 4
────────────────────────────────────────────────────
 9. storyline-books-core                    35 tasks   Phase 5
10. storyline-books-ui                      15 tasks   Phase 5
11. storyline-books-admin                   10 tasks   Phase 5
────────────────────────────────────────────────────
12. field-guide-collectible-discovery-core  18 tasks   Phase 6
13. field-guide-collectible-discovery-admin  8 tasks   Phase 6
────────────────────────────────────────────────────
14. community-campaign-notifications        TBD        Future
```

Within each phase, changes can be parallelized if desired. Phases must be sequential.

---

## Terminology Changes

| Old Term | New Term | Reason |
|----------|----------|--------|
| personal encounter template | personal encounter definition | It's not a template — it IS the configured encounter type |
| event template (generic) | encounter definition / campaign definition | Be specific about which domain |
| events-and-challenges | personal-challenges + community-campaigns | Two separate domains with separate tables |

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Shared achievement infra extracted** | 3 changes independently need identical badge patterns. One source of truth for idempotency, immutability, repeat counting |
| **Profile badge display is separate** | Standalone UI surface (~6 tasks) that multiple changes feed. Prevents each change from building its own badge grid |
| **Community campaigns use separate tables from personal challenges** | Deviations (public vs private, global vs eligibility-gated, join vs accept/decline, community targets vs personalized targets) outweigh surface-level similarity. Cleaner schemas, no nullable-column soup |
| **Admin UIs split from feature changes** | Each admin surface is separately deliverable. Features work without admin UI (Nazgul seeded via migration, campaigns creatable via API). Room for follow-on admin enhancements |
| **Storyline books: Core/UI split** | Core API responses are additive (no breakage). Default = whole-story mode. Badges appear progressively via profile. No hacks needed |
| **Field Guide: Core/Admin split** | Same pattern. Users discover collectibles immediately; admin UI arrives when catalog tuning is needed |
| **No shared "event" table** | The shared ground between personal challenges and community campaigns is too thin to justify unified schema |
| **"Encounter definition" not "template"** | The definition IS the encounter configuration; occurrences are concrete instances |

---

## Change Lifecycle Actions Needed

| Action | Changes Affected |
|--------|-----------------|
| **Keep as-is** | `goal-milestone-journals`, `goal-content-campfire-lore` |
| **Archive** | `events-and-challenges`, `storyline-books-and-achievements` |
| **Split + rename** | `field-guide-collectible-discovery` → `field-guide-collectible-discovery-core` + `field-guide-collectible-discovery-admin` |
| **Create new** | `shared-achievement-infrastructure`, `profile-badge-display`, `personal-challenges`, `personal-challenges-admin`, `community-campaigns`, `community-campaigns-admin`, `storyline-books-core`, `storyline-books-ui`, `storyline-books-admin` |
