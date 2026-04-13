---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - docs/prd.md
  - docs/architecture.md
  - docs/frontend-guide.md
  - docs/data-models.md
  - docs/api-reference.md
  - docs/design-guide.md
  - docs/asset-workflow.md
  - docs/email.md
---

# walk-to-mordor — Epic Breakdown (Phases 4–15)

## Overview

This document provides the epic and story breakdown for **Phases 4–15** of Walk to Mordor, building on the shipped Phases 1–3 (authentication, progress logging, milestones, interactive map, fellowship system, friends & social identity, admin portal). The current deployed application is the source of truth for existing state — all items from the previous epics file are either shipped or cancelled.

Each epic is designed to be independently deliverable (with noted exceptions for two explicit dependency chains). Stories within each epic are sequentially completable — no forward dependencies.

## Requirements Inventory

### Functional Requirements

| ID | Requirement | Phase |
|----|-------------|-------|
| **FR_DX_01** | ESLint configured with strict rules and legacy JS deprecation linter that flags new code in `public/js/` | 4 |
| **FR_DX_02** | Vite client build merged into Wrangler dev pipeline — single terminal, single watch command | 4 |
| **FR_DX_03** | Asset count dashboard in CI warns at 15k files, fails at 18k | 4 |
| **FR_STORE_01** | Unified Preact Signal global store (`appStore.ts`) for session, progress, and party state | 5 |
| **FR_DB_01** | D1 read replica wrapper — `db.read()` for all SELECT queries (zero cost now, enables replicas later) | 5 |
| **FR_SW_01** | Stale-while-revalidate API caching pattern in Service Worker for JSON responses | 5 |
| **FR_JUX_01** | Locked milestone cards show blurred preview art, title, and distance remaining | 6 |
| **FR_JUX_02** | Persistent journey progress bar component with milestone markers on the journey page | 6 |
| **FR_STAT_01** | The Palantír — weekly insight orb showing distance, pace, projection, and fellowship comparison | 7 |
| **FR_STAT_02** | Walk streak tracking and heatmap calendar (GitHub-style contribution grid) | 7 |
| **FR_STAT_03** | Year-End Appendices / Walk-to-Mordor Wrapped — Tolkien-style year-in-review with shareable stats | 7 |
| **FR_OFFLINE_01** | Offline write queue with D1 sync — IndexedDB queue in Service Worker, replay on reconnect | 7 |
| **FR_PUSH_01** | Web Push API infrastructure — VAPID keys, permission flow, subscription storage and management | 8 |
| **FR_PUSH_02** | "One More Mile" push notification — daily distance-to-next-milestone nudge | 8 |
| **FR_ENGAGE_01** | Gandalf's Absence Arc — narrative re-engagement sequence after 3+ inactive days | 8 |
| **FR_ENGAGE_02** | The Dead Marshes — inactive friends sink into marshes on map; tap to send encouragement | 8 |
| **FR_EVENT_01** | Event engine schema and lifecycle management for time-limited challenges | 9 |
| **FR_EVENT_02** | Nazgûl Pursuit Events — 72-hour personal challenges with cosmetic consequences | 9 |
| **FR_EVENT_03** | Community Milestones — global timed challenge with real-time progress bar | 9 |
| **FR_AI_01** | Workers AI generates personalized journey narration from distance, streak, and context data | 10 |
| **FR_AI_02** | Narration prompt engineering, rate limiting, and cached generated text storage | 10 |
| **FR_LEND_01** | Distance Lending / Shadowfax Express — gift surplus km to a friend with caps and cooldowns | 11 |
| **FR_ALLIANCE_01** | Cross-Fellowship Alliances — temporary alliance between two parties for mega-challenges | 12 |
| **FR_CONTENT_01** | Campfire Stories — 150-word lore snippets unlocked at milestones | 13 |
| **FR_CONTENT_02** | Poetry Anthology — Tolkien-inspired poems unlocked at milestones | 13 |
| **FR_CONTENT_03** | Appendices Deep Dives — extended lore essays unlocked at milestones | 13 |
| **FR_CONTENT_04** | Field Guide to Middle-earth Flora & Fauna — illustrated naturalist's sketchbook at regional milestones | 14 |
| **FR_CONTENT_05** | Milestone Journals — user-written entries at milestones, visible to friends | 15 |

### Non-Functional Requirements

| ID | Requirement | Phase |
|----|-------------|-------|
| **NFR_OFFLINE_01** | Cached UI shell + SWR JSON available when offline | 5 |
| **NFR_ASSET_01** | Workers Assets file count < 15k (warn) / < 18k (fail) enforced in CI | 4 |
| **NFR_PUSH_01** | Push notifications delivered < 30s from trigger event | 8 |
| **NFR_AI_01** | AI narration generated < 5s; cached response served thereafter | 10 |
| **NFR_REENGAGE_01** | > 50% of 3-day-inactive users return within 7 days of a nudge | 8 |
| **NFR_CONTENT_01** | > 60% of users who reach a milestone read the unlocked content | 13–15 |
| **NFR_TEST_01** | Maintain >90% test coverage for all new code (backend & UI) | All |
| **NFR_PERF_01** | <1s TTI on 4G networks maintained through all phases | All |

### Additional Requirements

#### From Architecture

| ID | Category | Requirement |
|----|----------|-------------|
| **ARCH_SW_01** | Service Worker | Extend `public/sw.js` beyond static caching with SWR for API responses |
| **ARCH_STORE_01** | State Management | Consolidate scattered signals into unified `appStore.ts` |
| **ARCH_CRON_01** | Scheduled Worker | Cron triggers for push notifications and re-engagement checks |
| **ARCH_AI_01** | AI Binding | Workers AI binding configuration in `wrangler.json` |
| **ARCH_IDB_01** | IndexedDB | Client-side offline queue for walk logs pending sync |

#### From Design Guide (Open Items)

| ID | Category | Requirement |
|----|----------|-------------|
| **UX_PROG_02** | Progress Bar | Persistent visual progress bar under total distance on journey page |
| **UX_GOAL_03** | Locked Goals | Milestone cards show blurred preview art and distance remaining when locked |
| **UX_HEATMAP_01** | Heatmap | GitHub-style contribution grid for walk history |

### FR Coverage Map

| FR | Epic | Brief Description |
|----|------|-------------------|
| FR_DX_01 | Epic 7 | ESLint + legacy deprecation linter |
| FR_DX_02 | Epic 7 | Unified Vite + Wrangler dev pipeline |
| FR_DX_03 | Epic 7 | Asset count CI dashboard |
| FR_STORE_01 | Epic 8 | Unified Preact Signal global store |
| FR_DB_01 | Epic 8 | D1 read replica wrapper |
| FR_SW_01 | Epic 8 | Service Worker SWR API caching |
| FR_JUX_01 | Epic 9 | Locked milestone card previews |
| FR_JUX_02 | Epic 9 | Persistent journey progress bar |
| FR_STAT_01 | Epic 10 | The Palantír weekly insights |
| FR_STAT_02 | Epic 10 | Walk streak & heatmap calendar |
| FR_STAT_03 | Epic 10 | Walk-to-Mordor Wrapped |
| FR_OFFLINE_01 | Epic 10 | Offline write queue with sync |
| FR_PUSH_01 | Epic 11 | Web Push infrastructure |
| FR_PUSH_02 | Epic 11 | "One More Mile" daily notification |
| FR_ENGAGE_01 | Epic 11 | Gandalf's Absence Arc |
| ~~FR_ENGAGE_02~~ | ~~Epic 11~~ | ~~The Dead Marshes~~ — CANCELLED |
| FR_EVENT_01 | Epic 12 | Event engine schema & lifecycle |
| FR_EVENT_02 | Epic 12 | Nazgûl Pursuit personal challenges |
| FR_EVENT_03 | Epic 12 | Community Milestones |
| FR_AI_01 | Epic 13 | Workers AI narration generation |
| FR_AI_02 | Epic 13 | Narration caching & rate limiting |
| FR_LEND_01 | Epic 14 | Distance Lending / Shadowfax Express |
| FR_ALLIANCE_01 | Epic 15 | Cross-Fellowship Alliances |
| FR_CONTENT_01 | Epic 16 | Campfire Stories |
| FR_CONTENT_02 | Epic 16 | Poetry Anthology |
| FR_CONTENT_03 | Epic 16 | Appendices Deep Dives |
| FR_CONTENT_04 | Epic 17 | Field Guide Flora & Fauna |
| FR_CONTENT_05 | Epic 18 | Milestone Journals |

## Epic List

### Epic 7: Developer Experience & Quality Guardrails (Phase 4)

**Goal:** Tighter development loop, automated quality gates, and legacy code deprecation linting — enabling faster, safer iteration for all future phases.

**FRs Covered:** FR_DX_01, FR_DX_02, FR_DX_03

**NFRs:** NFR_ASSET_01

**Status:** New — no dependencies on unshipped work

---

### Epic 8: Architecture & Performance Foundation (Phase 5)

**Goal:** Users experience faster page loads via SWR API caching, and the codebase gains a unified state management pattern and future-proof DB read/write separation for scalability.

**FRs Covered:** FR_STORE_01, FR_DB_01, FR_SW_01

**NFRs:** NFR_OFFLINE_01, NFR_PERF_01

**Status:** New — no dependencies on unshipped work

---

### Epic 9: Journey UX Enhancement (Phase 6)

**Goal:** Users see improved locked milestone cards with blurred preview art, title, and distance remaining, plus a persistent progress bar with milestone markers providing tangible visual momentum.

**FRs Covered:** FR_JUX_01, FR_JUX_02

**Status:** New — builds on existing goal cards and journey page

---

### Epic 10: Stats, Insights & Offline Writing (Phase 7)

**Goal:** Users gain compelling data views — weekly insights, walk streaks, year-in-review — and can log walks offline with automatic sync on reconnect.

**FRs Covered:** FR_STAT_01, FR_STAT_02, FR_STAT_03, FR_OFFLINE_01

**Dependencies:** Epic 8 (SWR pattern in Service Worker required for offline write queue)

**Status:** New

---

### Epic 11: Push Notifications & Re-engagement (Phase 8)

**Goal:** Themed, respectful nudges bring users back — daily distance reminders, narrative re-engagement arcs after inactivity, and social encouragement for inactive friends on the map.

**FRs Covered:** FR_PUSH_01, FR_PUSH_02, FR_ENGAGE_01, ~~FR_ENGAGE_02~~ (cancelled)

**NFRs:** NFR_PUSH_01, NFR_REENGAGE_01

**Status:** New — requires Web Push API infrastructure (VAPID keys, permission flow, subscription management)

---

### Epic 12: Events & Challenges (Phase 9)

**Goal:** Time-limited personal and community challenges create urgency and collective achievement moments.

**FRs Covered:** FR_EVENT_01, FR_EVENT_02, FR_EVENT_03

**Status:** New

---

### Epic 13: AI-Powered Narration (Phase 10)

**Goal:** Users receive personalized AI-generated journey narration that evolves with their progress, creating an immersive daily reading experience powered by Workers AI.

**FRs Covered:** FR_AI_01, FR_AI_02

**NFRs:** NFR_AI_01

**Status:** New

---

### Epic 14: Distance Lending — Shadowfax Express (Phase 11)

**Goal:** Friends can gift surplus km to struggling companions within fellowship contexts, with caps and cooldowns to maintain fairness.

**FRs Covered:** FR_LEND_01

**Status:** New — builds on existing friends and fellowship systems

---

### Epic 15: Cross-Fellowship Alliances (Phase 12)

**Goal:** Two fellowships can form temporary alliances for mega-challenges, creating cross-group community experiences.

**FRs Covered:** FR_ALLIANCE_01

**Dependencies:** Epic 12 (event engine required for mega-challenge lifecycle)

**Status:** New

---

### Epic 16: Milestone Content — Campfire Stories & Lore (Phase 13)

**Goal:** Users unlock rich written content at milestones — short lore snippets, poetry, and deep-dive appendices that reward progress with Tolkien-inspired storytelling.

**FRs Covered:** FR_CONTENT_01, FR_CONTENT_02, FR_CONTENT_03

**NFRs:** NFR_CONTENT_01

**Status:** New — attaches to existing milestone/goal system

---

### Epic 17: Milestone Content — Field Guide (Phase 14)

**Goal:** Users discover an illustrated naturalist's sketchbook of Middle-earth flora and fauna, unlocked regionally as they walk through different areas.

**FRs Covered:** FR_CONTENT_04

**NFRs:** NFR_CONTENT_01

**Status:** New — attaches to existing milestone/goal system

---

### Epic 18: Milestone Content — Milestone Journals (Phase 15)

**Goal:** Users write personal journal entries at milestones visible to their friends, turning the journey into a shared storytelling experience.

**FRs Covered:** FR_CONTENT_05

**NFRs:** NFR_CONTENT_01

**Status:** New — builds on existing friends system and milestone/goal system

---

## Stories

### Epic 7: Developer Experience & Quality Guardrails

#### Story 7.1: ESLint Configuration & Legacy Deprecation Rules

**Priority:** P1

**Description:** Configure ESLint with strict TypeScript rules for the project and add a custom rule (or plugin) that flags new code written in `public/js/` as deprecated, steering all new development toward `client/src/`.

As a developer,
I want automated linting that enforces code quality and prevents new legacy JS,
So that code consistency improves and future work stays in the Preact island architecture.

**Acceptance Criteria:**

**Given** the project has no ESLint configuration
**When** `npm run lint` is executed
**Then** ESLint runs across `src/`, `client/src/`, and `public/js/` with strict TypeScript rules enabled
**And** existing violations in `public/js/` do not fail the lint (baseline/ignore pattern for legacy code)
**And** any newly added or modified file in `public/js/` triggers a deprecation warning: "New code should be in client/src/"
**And** `src/` and `client/src/` enforce strict TypeScript-ESLint rules (no `any`, consistent returns, etc.)
**And** an `npm run lint` script is added to `package.json`
**And** ESLint configuration is documented in the project root

**Technical Notes:**
- Use ESLint flat config (eslint.config.js) with `@typescript-eslint/eslint-plugin`
- For the legacy deprecation rule: a simple `no-restricted-syntax` or custom local rule scoped to `public/js/**` glob
- Consider `eslint-plugin-deprecation` or a `.eslintrc` override pattern for `public/js/`
- Do not fix existing lint errors in legacy JS — only flag new ones

**FRs:** FR_DX_01

**Dependencies:** None

---

#### Story 7.2: Unified Vite + Wrangler Dev Pipeline

**Priority:** P1

**Description:** Merge the Vite client build watch and Wrangler dev server into a single terminal command so developers run one command for local development with hot-reloading for both worker and client code.

As a developer,
I want a single `npm run dev` command that watches both worker and client code,
So that I don't need to manage multiple terminal windows during development.

**Acceptance Criteria:**

**Given** the current setup requires separate `npm run dev:client` and `npx wrangler dev` commands
**When** `npm run dev` is executed
**Then** both the Wrangler dev server and Vite client watch mode start concurrently in a single terminal
**And** changes to `client/src/` trigger Vite rebuild and the browser reflects changes
**And** changes to `src/` trigger Wrangler reload
**And** D1 migrations are applied to the local database on startup (existing behavior preserved)
**And** `Ctrl+C` cleanly terminates both processes
**And** the merged command is documented in `docs/frontend-guide.md`

**Technical Notes:**
- Use `concurrently` or similar to run both processes. Wrangler v3+ has `--assets` handling that may simplify this.
- Existing `npm run dev` in `package.json` may already partially handle this — check current state and extend if needed
- Vite watch output goes to `public/js/client/` which Wrangler serves via Assets binding
- Ensure build order: Vite builds first, then Wrangler starts (or Wrangler handles initial missing assets gracefully)

**FRs:** FR_DX_02

**Dependencies:** None

---

#### Story 7.3: Asset Count CI Dashboard

**Priority:** P2

**Description:** Add an automated check to the CI pipeline that counts files under `public/` and enforces the Workers Assets budget: warn at 15,000 files, fail at 18,000 files.

As a developer,
I want CI to automatically track and enforce the static asset file count budget,
So that we never accidentally exceed Cloudflare Workers Assets limits and deployments stay safe.

**Acceptance Criteria:**

**Given** the `public/` directory contains static assets served via Workers Assets binding
**When** a CI pipeline runs (e.g., GitHub Actions workflow)
**Then** the pipeline counts all files under `public/` recursively
**And** if the count is < 15,000, the check passes with a summary annotation showing the current count
**And** if the count is ≥ 15,000 and < 18,000, the check passes with a warning annotation
**And** if the count is ≥ 18,000, the check fails with an error
**And** the asset count is visible in the CI output / PR check summary

**Technical Notes:**
- Implement as a GitHub Actions step (shell script: `find public -type f | wc -l`)
- Current file count should be well under 15k; this is a guard rail for future growth
- Consider outputting a breakdown by directory (e.g., `img/`, `js/`, `css/`) for visibility
- Could also be a pre-deploy hook in `package.json` for local verification

**FRs:** FR_DX_03 | **NFRs:** NFR_ASSET_01

**Dependencies:** None

---

### Epic 8: Architecture & Performance Foundation

#### Story 8.1: Unified Preact Signal Global Store

**Priority:** P1

**Description:** Consolidate session, progress, and party state into a unified global Preact Signal store (`appStore.ts`) that all islands consume, replacing scattered signal declarations and localStorage workarounds.

As a user,
I want the app to manage state consistently across all pages,
So that my session, progress, and fellowship data are always in sync without stale state bugs.

**Acceptance Criteria:**

**Given** state is currently scattered across `mapStore.ts`, `partyStore.ts`, `localStorage`, and bridge globals
**When** `appStore.ts` is created in `client/src/stores/`
**Then** it provides computed signals for: session data (userId, username, avatarId, preferences), user progress (totalDistance, currentMilestone), and active party context
**And** `appStore.ts` initializes from the `/api/session` response on page load
**And** existing stores (`mapStore.ts`, `partyStore.ts`) integrate with `appStore` rather than duplicating session state
**And** islands consuming session state migrate to read from `appStore` signals
**And** bridge globals (`window.partyStore`) continue to work for legacy JS interop
**And** all existing tests continue to pass
**And** new unit tests cover `appStore` initialization, signal reactivity, and error states

**Technical Notes:**
- Preact Signals are already the state management pattern — this story consolidates, not replaces
- Keep `mapStore` and `partyStore` as domain-specific slices that compose with `appStore`
- Session signal should be the single source that hydrated islands read from — no more per-island `/api/session` calls
- `window.userPreferences` bridge global must stay in sync (legacy `goals.js` depends on it)

**FRs:** FR_STORE_01 | **NFRs:** NFR_PERF_01

**Dependencies:** None

---

#### Story 8.2: D1 Read Replica Wrapper

**Priority:** P1

**Description:** Introduce a `db.read()` wrapper function for all SELECT queries that currently use the `env.DB` binding directly. Zero behavior change now; enables future D1 read replica separation without touching handler code.

As a developer,
I want all database reads to go through a `db.read()` wrapper,
So that we can enable D1 read replicas in the future by changing one function without modifying every handler.

**Acceptance Criteria:**

**Given** all current database queries use `env.DB.prepare(...)` directly
**When** a `createDbClient(env.DB)` utility is created in `src/db.ts`
**Then** it returns an object with `.read` (for SELECT) and `.write` (for INSERT/UPDATE/DELETE) methods
**And** both `.read` and `.write` delegate to `env.DB` today (identical behavior)
**And** all handler files (`auth-handlers.ts`, `progress-handlers.ts`, `goals-handlers.ts`, `party-handlers.ts`, `friends-handlers.ts`, `fellowship-invite-handlers.ts`, `admin-handlers.ts`) are migrated to use `db.read()` / `db.write()` instead of raw `env.DB`
**And** the `db` client is created once per request in `src/index.ts` and passed to handlers
**And** all existing tests pass with no behavior change
**And** documentation in `docs/architecture.md` notes the read/write separation pattern

**Technical Notes:**
- This is a pure refactor — zero behavior change. Both `.read` and `.write` call `env.DB` today.
- When D1 read replicas ship, only `db.read()` implementation changes to use `env.DB.withSession('read-replica')` or whatever the API becomes
- Pattern: `const db = createDbClient(env.DB)` in the request handler, then pass `db` to domain handlers
- Existing `env.DB.batch([...])` calls should use `db.write.batch([...])` since batches that include writes must go to the primary

**FRs:** FR_DB_01

**Dependencies:** None

---

#### Story 8.3: Service Worker SWR API Caching

**Priority:** P1

**Description:** Extend the existing Service Worker (`public/sw.js`) with a stale-while-revalidate caching strategy for JSON API responses, giving users instant cached data while fresh data loads in the background.

As a user,
I want pages to load instantly with cached API data and then silently refresh,
So that the app feels fast even on slow connections and I see my data immediately.

**Acceptance Criteria:**

**Given** the current Service Worker only caches static assets (cache-first strategy with build-stamped cache name)
**When** the Service Worker intercepts a `GET` request to `/api/*` endpoints
**Then** it checks the SWR API cache for a matching response
**And** if a cached response exists, it returns it immediately to the page
**And** simultaneously fetches the fresh response from the network in the background
**And** on fresh response success, updates the cache entry with the new response
**And** emits a `sw-cache-updated` message via `postMessage` to the client so islands can reactively update if data changed
**And** if no cached response exists, the request goes directly to the network (network-first for first load)
**And** write endpoints (`POST`, `PUT`, `DELETE`) are never cached and always go to the network
**And** cache entries have a configurable TTL (default: 5 minutes) after which stale entries are still served but flagged
**And** the SWR cache is separate from the static asset cache (different cache name)
**And** existing static asset caching continues to work unchanged
**And** tests verify SWR caching behavior for API responses

**Technical Notes:**
- Target endpoints for SWR: `GET /api/session`, `GET /api/goals`, `GET /api/calendar-progress`, `GET /api/total-distance`, `GET /api/user/parties`, `GET /api/friends`
- Do NOT SWR-cache: `GET /api/party/:id/activity` (real-time feed), `GET /api/friends/pending` (time-sensitive)
- The `postMessage` pattern allows islands to update without polling — signal stores can listen for `sw-cache-updated` events
- Keep a simple `cacheVersion` key to bust the SWR cache on deploys alongside the static cache

**FRs:** FR_SW_01 | **NFRs:** NFR_OFFLINE_01

**Dependencies:** None

---

### Epic 9: Journey UX Enhancement

#### Story 9.1: Locked Milestone Card Previews

**Priority:** P1

**Description:** Enhance locked milestone/goal cards to show a blurred preview image, the milestone title, and distance remaining — replacing the current minimal locked state with an enticing preview that motivates forward progress.

As a user,
I want to see blurred previews of upcoming milestones with their titles and distance remaining,
So that I feel motivated to keep walking and can anticipate what's ahead.

**Acceptance Criteria:**

**Given** a user has not yet reached a milestone (total distance < milestone distance)
**When** the milestone card renders in the goals list on the journey page
**Then** it shows the milestone's thumbnail image with a CSS blur filter applied (blur radius ~8px)
**And** the milestone title is visible (not blurred) overlaid on the card
**And** the distance remaining (milestone distance − user total distance) is displayed prominently (e.g., "42.3 km to go")
**And** the card is not clickable / does not open the GoalModal (locked state preserved)
**And** the user's `showFutureGoalsUnlocked` preference is respected — if the user has opted to preview all milestones unlocked, cards show without blur (existing behavior)
**And** the blurred preview works with the existing lazy-loading (blur-up) image pattern
**And** the change works in both the journey page goals list and on map waypoint detail popups
**And** visual styling is consistent with the dark fantasy theme (subtle lock icon overlay optional)
**And** the locked card is accessible (WCAG AA contrast on overlaid text)

**Technical Notes:**
- The existing `UpcomingGoalCard` and `goals.js` both render goal cards — this change primarily targets the upcoming goals display
- CSS `filter: blur(8px)` on the thumbnail `<img>` element; overlay text via absolute positioning
- Respect `window.userPreferences.showFutureGoalsUnlocked` for the legacy JS path
- No new API changes needed — goal data already includes `image_id` and `distance` for all milestones

**FRs:** FR_JUX_01 | **UX:** UX_GOAL_03

**Dependencies:** None

---

#### Story 9.2: Persistent Journey Progress Bar

**Priority:** P1

**Description:** Add a persistent progress bar component to the journey page that shows the user's overall progress across the full 6,425 km route, with milestone markers indicating key waypoints.

As a user,
I want to see a visual progress bar showing how far I've come on the full journey,
So that I have a tangible sense of my overall achievement and can see upcoming milestones at a glance.

**Acceptance Criteria:**

**Given** a user is on the journey page (`/journey`)
**When** the page loads with the user's progress data
**Then** a horizontal progress bar is displayed below the total distance heading
**And** the bar fills proportionally to `totalDistance / 6425` (the full route length in km)
**And** small tick marks on the bar indicate major milestone positions (configurable — e.g., every 500km or key named locations like Rivendell, Moria, Mordor)
**And** the current position is highlighted with an indicator (ring icon or marker)
**And** hovering/tapping a tick mark shows the milestone name in a tooltip
**And** the progress bar is responsive — on mobile, tick labels are hidden but marks remain
**And** the bar uses theme-appropriate styling (gold fill on dark track, matching `--gold-accent` CSS variable)
**And** when viewing fellowship progress (via PartySelector), the bar reflects the fellowship's combined distance
**And** the component is implemented as a reusable Preact component in `client/src/components/ProgressBar.tsx`
**And** tests cover rendering at 0%, partial, and 100% progress

**Technical Notes:**
- Render as an SVG or CSS-based bar — SVG gives better control for milestone marker placement
- Milestone marker positions are `milestone.distance / 6425` as percentage offsets
- Major milestones for tick marks: use a subset of goals (e.g., goals with `special = 1` or a curated list of ~10–15 key locations)
- Progress data is already available from `/api/total-distance` and `/api/goals`
- Fellowship support: when `PartySelector` is active, substitute party `total_distance` from `/api/party/:id/progress`

**FRs:** FR_JUX_02 | **UX:** UX_PROG_02

**Dependencies:** None

---

### Epic 10: Stats, Insights & Offline Writing

#### Story 10.1: The Palantír — Weekly Insight Orb

**Priority:** P1

**Description:** Create a weekly insight component ("The Palantír") that shows the user a summary of their walking activity for the past week — distance, pace trend, projected arrival at next milestone, and optional fellowship comparison.

As a user,
I want to see a weekly summary of my walking stats and pace,
So that I can track my consistency, see my trajectory, and stay motivated.

**Acceptance Criteria:**

**Given** a user has logged at least one walk in the past 30 days
**When** the user visits the journey page
**Then** a Palantír insight component is displayed showing:
- **This week's distance** (sum of walks in last 7 days)
- **Pace trend** (this week vs. previous week — up/down/same arrow + percentage)
- **Projection** ("At this pace, you'll reach [next milestone] in ~X days")
- **Fellowship comparison** (if user is in a party: "You contributed X% of [Party Name]'s progress this week")
**And** the component displays a themed visual (orb/crystal ball aesthetic matching dark fantasy theme)
**And** if the user has no walks this week, it shows an encouraging message ("The Palantír sees no movement… perhaps tomorrow?")
**And** the insight data is computed server-side via a new `GET /api/stats/weekly` endpoint
**And** the endpoint returns `{ thisWeekDistance, lastWeekDistance, paceTrend, projectedMilestoneDays, fellowshipContributionPct, fellowshipName }`
**And** the component is a Preact island or component rendered on the journey page
**And** tests cover the API endpoint and UI rendering for all states (active, inactive, fellowship, no fellowship)

**Technical Notes:**
- `GET /api/stats/weekly` computes from the `progress` table: `SELECT SUM(distance) FROM progress WHERE user_id = ? AND date >= date('now', '-7 days')`
- Pace trend: compare this week sum vs previous week sum (date ranges relative to today)
- Projection: `remaining_distance / (this_week_distance / 7)` = estimated days
- Fellowship contribution: `user_contribution / party_total_this_week * 100` if user belongs to a party
- Cache result in SWR cache (from Epic 8) — only changes once per day meaningfully

**FRs:** FR_STAT_01

**Dependencies:** None (works without Epic 8 SWR; SWR adds caching benefit if available)

---

#### Story 10.2: Walk Streak & Heatmap Calendar

**Priority:** P1

**Description:** Add a GitHub-style contribution heatmap calendar showing walk history, plus streak tracking that counts consecutive days with logged walks.

As a user,
I want to see a visual heatmap of my walking history and my current streak,
So that I feel achievement from consistency and can see patterns in my activity.

**Acceptance Criteria:**

**Given** a user has logged walk data in the `progress` table
**When** the user visits a new stats section on the journey page (or a dedicated `/stats` page)
**Then** a heatmap calendar is displayed showing the past 365 days (or since account creation, whichever is shorter)
**And** each day cell is colored by intensity: no walk (empty/dark), light walk (light shade), heavy walk (bright shade) — using 4–5 intensity buckets based on distance
**And** hovering/tapping a day shows the date and distance logged
**And** the current walk streak (consecutive days with ≥ 1 walk logged) is displayed prominently (e.g., "🔥 12-day streak")
**And** the longest-ever streak is also shown
**And** a new `GET /api/stats/heatmap` endpoint returns `{ days: [{ date, distance }], currentStreak, longestStreak }`
**And** the heatmap is responsive — on mobile, it shows fewer columns (e.g., last 6 months) or scrolls horizontally
**And** the heatmap component is implemented as a Preact component in `client/src/components/HeatmapCalendar.tsx`
**And** tests cover the API endpoint (streak calculation edge cases: gaps, single day, no data) and component rendering

**Technical Notes:**
- Heatmap data: `SELECT date, distance FROM progress WHERE user_id = ? AND date >= date('now', '-365 days') ORDER BY date ASC`
- Streak calculation: iterate days backward from today; count consecutive days with an entry
- Intensity buckets: 0 km (empty), 0–2 km (level 1), 2–5 km (level 2), 5–10 km (level 3), 10+ km (level 4) — tune based on user data distribution
- Render as an SVG grid (52 columns × 7 rows) or CSS grid with `<div>` cells
- Color scale: dark background → green/gold intensity levels (theme-appropriate)

**FRs:** FR_STAT_02 | **UX:** UX_HEATMAP_01

**Dependencies:** None

---

#### Story 10.3: Walk-to-Mordor Wrapped — Year-End Review

**Priority:** P2

**Description:** A Tolkien-themed year-in-review experience that surfaces annual stats in a shareable, narrative format — inspired by Spotify Wrapped but with Middle-earth flavor.

As a user,
I want to see a year-in-review summary of my walking journey,
So that I can celebrate my annual achievements and share my journey highlights with friends.

**Acceptance Criteria:**

**Given** a user has logged walks during the calendar year
**When** the user navigates to a "Year in Review" section (accessible from stats or a seasonal notification)
**Then** a multi-page narrative experience is displayed with:
- **Total distance for the year** ("You walked XXX km — that's X% of the journey to Mordor!")
- **Total walk count and active days**
- **Best streak of the year**
- **Favorite walking month** (month with highest total)
- **Milestones unlocked this year** (with images)
- **Fellowship highlights** (if applicable: "You and The Fellowship walked XX km together")
- **A Tolkien-flavored narrative summary** (template-based, e.g., "Like Bilbo in the Shire, you took your first step on [first walk date]…")
**And** the review is paginated as a scrollable card sequence (swipeable on mobile)
**And** a "Share" button generates a static shareable image or card (using Canvas API or pre-rendered template)
**And** the share image includes: total distance, milestones unlocked count, and a themed background
**And** a new `GET /api/stats/wrapped?year=YYYY` endpoint returns the annual summary data
**And** the Wrapped experience is implemented as a Preact island (`WrappedIsland`)
**And** tests cover data aggregation and rendering

**Technical Notes:**
- Template-based narration (not AI) — use string templates with variable interpolation
- Share image: use `<canvas>` to render a themed card or generate server-side as a PNG endpoint
- Consider making this time-gated (available December–January) or always accessible via `/stats/wrapped/YYYY`
- Year data: aggregate from `progress` table with `strftime('%Y', date) = ?`
- Keep the share image to a simple, branded design — avoid complex rendering

**FRs:** FR_STAT_03

**Dependencies:** None

---

#### Story 10.4: Offline Write Queue with D1 Sync — CANCELLED

**Status:** Cancelled 2026-04-08. SW offline intercept could not be reliably verified in real browser testing despite passing unit tests. Feature deemed too fragile for production.

**Priority:** P1

**Description:** Implement an IndexedDB-backed offline write queue in the Service Worker that captures walk log requests when offline and replays them to D1 when connectivity is restored.

As a user,
I want to log my walks even when I'm offline,
So that I never lose a walk entry due to poor connectivity and my data syncs automatically when I'm back online.

**Acceptance Criteria:**

**Given** the user is offline or the network request to `POST /api/calendar-progress` fails with a network error
**When** the user submits a walk log entry
**Then** the entry is stored in an IndexedDB queue (`offline-walk-queue`) managed by the Service Worker
**And** the user sees a confirmation with an "offline" indicator (e.g., "Walk saved — will sync when online")
**And** the queued entry appears in the calendar UI with a visual "pending sync" indicator
**And** when connectivity is restored (Service Worker detects `online` event or next successful fetch)
**Then** all queued entries are replayed to `POST /api/calendar-progress` in chronological order
**And** on successful sync, the pending indicator is removed and the entry becomes permanent
**And** if a sync attempt fails (e.g., server validation error), the entry is flagged with the error reason and the user is notified
**And** duplicate prevention: if the same `(date, distance)` entry already exists server-side, the sync skips it gracefully
**And** edit and delete operations (`PUT`, `DELETE /api/calendar-progress`) are NOT queued offline — only new entries
**And** the queue is capped at 100 entries to prevent abuse
**And** tests cover: queue storage, replay on reconnect, error handling, duplicate prevention

**Technical Notes:**
- The Service Worker intercepts `POST /api/calendar-progress` — if the network request fails, store the request body in IndexedDB
- Use the Background Sync API (`self.registration.sync.register('sync-walks')`) if supported, with a fallback polling mechanism
- IndexedDB schema: `{ id: auto, date: string, distance: number, createdAt: timestamp, status: 'pending'|'synced'|'error', errorReason?: string }`
- Replay order matters — replay oldest first to maintain chronological integrity
- Client-side: listen for Service Worker messages (`sw-sync-complete`, `sw-sync-error`) to update UI
- This depends on Epic 8 only conceptually (SWR pattern establishes the SW extension point) — but can be implemented independently as long as the SW intercept pattern is added

**FRs:** FR_OFFLINE_01 | **NFRs:** NFR_OFFLINE_01

**Dependencies:** Epic 8 Story 8.3 (Service Worker SWR pattern establishes SW API intercept infrastructure)

---

### Epic 11: Push Notifications & Re-engagement

#### Story 11.1: Web Push API Infrastructure

**Priority:** P0 (Blocker for other Push stories)

**Description:** Set up the Web Push API infrastructure: VAPID key generation, push subscription management, client-side permission flow, and a `push_subscriptions` table for subscription storage.

As a user,
I want to be able to opt-in to push notifications from the app,
So that I can receive timely walking reminders and engagement nudges.

**Acceptance Criteria:**

**Given** the app has no push notification capability
**When** the Web Push infrastructure is implemented
**Then** VAPID key pair is generated and stored as Worker secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`)
**And** a new `push_subscriptions` table is created: `id`, `user_id` (FK → users.id, CASCADE), `endpoint` (TEXT, UNIQUE), `keys_p256dh` (TEXT), `keys_auth` (TEXT), `created_at`, `last_used_at`
**And** a migration file is created for the new table
**And** `POST /api/push/subscribe` — stores a push subscription for the authenticated user. Body: `{ endpoint, keys: { p256dh, auth } }`. Upserts by endpoint.
**And** `DELETE /api/push/subscribe` — removes the subscription for the current browser/endpoint. Body: `{ endpoint }`.
**And** `GET /api/push/status` — returns whether the current user has any active subscriptions
**And** a client-side `PushPermission` Preact component is created that:
  - Checks browser support for Push API
  - Requests notification permission (`Notification.requestPermission()`)
  - On grant: subscribes via `serviceWorkerRegistration.pushManager.subscribe()` with the VAPID public key
  - Sends the subscription to `POST /api/push/subscribe`
  - Shows a toggle in profile settings to enable/disable notifications
**And** the Service Worker handles `push` events: parses the payload, displays a notification via `self.registration.showNotification()`
**And** the Service Worker handles `notificationclick` events: opens the app to the relevant URL
**And** expired/invalid subscriptions (HTTP 410 Gone from push service) are automatically cleaned up on send failure
**And** all endpoints validate auth (401 if unauthenticated)
**And** tests cover subscription CRUD, permission flow, and push event handling

**Technical Notes:**
- Generate VAPID keys: `npx web-push generate-vapid-keys` → store as Wrangler secrets
- Push API sending uses the standard `fetch()` to the subscription endpoint with VAPID JWT header — see RFC 8030 + RFC 8292
- The `keys_p256dh` and `keys_auth` are the browser-generated encryption keys needed to encrypt push payloads
- Consider a `sendPushNotification(userId, payload)` utility in `src/push-utils.ts` that handles encoding, signing, and delivery
- Multiple devices per user: allow multiple subscriptions per `user_id`
- The permission prompt should be contextual (shown after first walk, not on page load) to maximize grant rate

**FRs:** FR_PUSH_01

**Dependencies:** None

---

#### Story 11.2: "One More Mile" Daily Push Notification

**Priority:** P1

**Description:** Send a daily push notification to opted-in users showing how far they are from their next milestone, using a Tolkien-themed encouragement message.

As a user,
I want a daily notification telling me how close I am to my next milestone,
So that I'm reminded to walk and motivated by seeing the finish line.

**Acceptance Criteria:**

**Given** a user has an active push subscription and has logged at least one walk
**When** the scheduled Worker cron trigger fires daily (e.g., 8:00 AM UTC)
**Then** for each user with at least one active push subscription:
- Calculate their next milestone and remaining distance
- Select a themed message template (e.g., "The road goes ever on — only 12.3 km to Rivendell!")
- Send a push notification with the message and a deep-link to the journey page
**And** the notification includes the milestone name, remaining distance, and an appropriate icon
**And** users who have reached their current next milestone (and need a new one) get the correct next milestone
**And** users who have completed the entire journey get a different message ("You've reached Mount Doom! But the journey home awaits…")
**And** the notification respects the user's push subscription status — no notifications to unsubscribed users
**And** a scheduled Worker cron trigger is configured in `wrangler.json` (`crons = ["0 8 * * *"]`)
**And** the `scheduled()` handler in the Worker processes users in batches to stay within D1 and execution time limits
**And** failed notification deliveries (expired subscriptions) clean up the subscription record
**And** the notification message has 5–10 template variants to avoid repetition
**And** tests cover: message generation, milestone calculation, batch processing, cleanup

**Technical Notes:**
- Cron trigger: add `[triggers]` section to `wrangler.json` with a daily cron schedule
- Batch processing: query users in pages of 100, process each batch's notifications, then next batch
- Message templates stored in code (array of template strings with `{milestone}` and `{distance}` placeholders)
- Consider timezone awareness in the future — for now, a single UTC time is acceptable
- Cloudflare Workers cron triggers have a 30-second CPU time limit; batch accordingly
- Rate limit: max 1 notification per user per day

**FRs:** FR_PUSH_02 | **NFRs:** NFR_PUSH_01

**Dependencies:** Story 11.1 (Push infrastructure)

---

#### Story 11.3: Gandalf's Absence Arc — Narrative Re-engagement

**Priority:** P2

**Description:** After 6+ days of inactivity, send a sequence of Tolkien-themed push notifications that follow a narrative arc — from gentle encouragement to dramatic urgency — to bring the user back.

As an inactive user,
I want to receive themed narrative nudges that feel like part of the story,
So that I'm drawn back to the app in a way that feels immersive rather than nagging.

**Acceptance Criteria:**

**Given** a user has not logged a walk in 6 or more consecutive days and has an active push subscription
**When** the daily scheduled Worker runs
**Then** the user receives a push notification from a tiered narrative sequence:
- **Day 6**: Gentle ("Gandalf notices you've paused. 'Even the smallest step counts,' he says.")
- **Day 10**: Concerned ("The Fellowship grows worried. Sam keeps glancing back down the road…")
- **Day 15**: Urgent ("Darkness spreads. Without you, the journey may be lost. Return, friend!")
- **Day 25+**: Dramatic final ("A moth finds you with a message from Gandalf: 'It is not too late.'")
**And** each tier is sent only once (tracked via a `last_reengage_tier` column or similar on users/push_subscriptions)
**And** the tier resets when the user logs a new walk (activity resumes)
**And** the notification deep-links to the journey page
**And** the system does NOT send re-engagement notifications to users who have never logged a walk (dormant accounts)
**And** the notification cadence does not exceed one re-engagement notification per inactivity period per tier
**And** tests cover: tier progression, reset on activity, dormant account exclusion, once-per-tier enforcement

**Technical Notes:**
- Add `last_walk_date` (computed or cached) and `reengage_tier_sent` INTEGER (0–4) to track state
- The scheduled Worker already runs daily (Story 11.2) — add re-engagement as a second pass in the same handler
- Query: `SELECT user_id FROM users WHERE last_walk_date < date('now', '-6 days') AND reengage_tier_sent < 4`
- Tier thresholds: `[6, 10, 15, 25]` days since last walk → tier `[1, 2, 3, 4]`
- Reset `reengage_tier_sent = 0` when a new walk is logged (add to walk logging handler)

**FRs:** FR_ENGAGE_01 | **NFRs:** NFR_REENGAGE_01

**Dependencies:** Story 11.1 (Push infrastructure), Story 11.2 (Scheduled Worker cron)

---

#### ~~Story 11.4: The Dead Marshes — Inactive Friends on Map~~ — CANCELLED

**Status:** Cancelled — redundant with existing notification patterns; may revisit later.

**Priority:** P2

**Description:** Inactive friends (no walks in 7+ days) visually "sink" into marshes on the map with a desaturated/ghostly effect. Tapping their marker reveals a "Send Encouragement" action that sends a themed push notification to the inactive friend.

As a user,
I want to see which of my friends have gone inactive and be able to nudge them,
So that I can help my friends stay on track and we motivate each other.

**Acceptance Criteria:**

**Given** a user has friends visible on the map (Friends on Map toggle is enabled)
**When** a friend has not logged a walk in 7+ days
**Then** their avatar marker on the map changes to a desaturated/ghostly visual (CSS grayscale filter + optional "sinking" animation)
**And** a subtle "marsh" visual effect is applied around their marker (misty, dark green aura)
**And** tapping the inactive friend's marker shows the mini-card with their name, last active date, and an "Encourage" button
**And** clicking "Encourage" sends a `POST /api/friends/:userId/encourage` request
**And** the API sends a themed push notification to the inactive friend: "A friend calls out to you from the path ahead! [Username] wants you back on the road."
**And** the encourage action is rate-limited: max 1 encouragement per friend per 24 hours (prevent spam)
**And** the encouragement sender sees a confirmation ("Encouragement sent to [Username]!")
**And** the `GET /api/friends/positions` response is extended with a `lastActiveDate` field for each friend
**And** friends who have been inactive for 30+ days fully disappear from the map (too deep in the marshes)
**And** the `POST /api/friends/:userId/encourage` endpoint validates: friendship exists, target is inactive, rate limit not exceeded, target has push subscription
**And** if the target has no push subscription, the encouragement is still recorded (future: in-app notification) and the sender sees "Encouragement sent!" (no error)
**And** tests cover: visual state changes, encourage API, rate limiting, push delivery

**Technical Notes:**
- Extend `GET /api/friends/positions` response: add `lastActiveDate` (the `MAX(date)` from their `progress` table — already computed in friends endpoints)
- CSS grayscale + opacity reduction: `filter: grayscale(80%) opacity(0.7)` on the Konva avatar image
- Marsh effect: a semi-transparent dark-green ellipse behind the avatar in the Konva layer
- Encourage endpoint: insert into a `friend_encouragements` log table (id, sender_id, receiver_id, sent_at) for rate limit tracking — or use a simpler in-memory/cache approach
- The "sinking" animation should respect `prefers-reduced-motion`

**FRs:** FR_ENGAGE_02

**Dependencies:** Story 11.1 (Push infrastructure)

---

### Epic 12: Events & Challenges

#### Story 12.1: Event Engine Schema & API

**Priority:** P0 (Blocker for other Event stories)

**Description:** Create the foundational event engine schema and lifecycle management API that supports both personal challenges and community events — a reusable scaffolding for all time-limited challenges.

As a developer,
I want a reusable event engine with lifecycle management,
So that personal challenges and community events can be built on a shared foundation.

**Acceptance Criteria:**

**Given** no event infrastructure exists
**When** the event engine is implemented
**Then** a new `events` table is created: `id`, `type` (TEXT: 'personal' | 'community'), `name` (TEXT), `description` (TEXT), `goal_distance` (DECIMAL, nullable — for distance-based events), `start_at` (DATETIME), `end_at` (DATETIME), `status` (TEXT: 'upcoming' | 'active' | 'completed' | 'expired'), `metadata` (TEXT, JSON blob for event-specific config), `created_by` (FK → users.id, nullable — NULL for system-created), `created_at`
**And** a new `event_participants` table is created: `id`, `event_id` (FK → events.id, CASCADE), `user_id` (FK → users.id, CASCADE), `joined_at`, `progress_distance` (DECIMAL, default 0), `completed_at` (DATETIME, nullable), `status` (TEXT: 'active' | 'completed' | 'failed' | 'abandoned')
**And** UNIQUE constraint on `(event_id, user_id)` prevents duplicate participation
**And** admin API endpoints exist:
  - `POST /api/admin/events` — create event (admin only)
  - `PUT /api/admin/events/:id` — update event (admin only)
  - `GET /api/admin/events` — list all events with status filter (admin only)
**And** public API endpoints exist:
  - `GET /api/events` — list active/upcoming events for the current user
  - `GET /api/events/:id` — event detail with participant count, user's participation status
  - `POST /api/events/:id/join` — join an event
  - `POST /api/events/:id/abandon` — abandon an event (personal only)
**And** a scheduled Worker handler transitions event statuses automatically: `upcoming` → `active` at `start_at`, `active` → `expired` at `end_at`
**And** event progress is updated automatically when a walk is logged (cross-cutting: same pattern as party_progress_log integration)
**And** documentation in `docs/data-models.md` covers the event schema
**And** tests cover CRUD, lifecycle transitions, participation, and walk-log integration

**Technical Notes:**
- The `metadata` JSON field allows event-specific config without schema changes (e.g., Nazgûl pursuit cosmetic outcomes, community milestone theme)
- Event progress tracking: when a walk is logged via `POST /api/calendar-progress`, also update `event_participants.progress_distance` for all active events the user has joined (similar to the `party_progress_log` integration pattern)
- Status transitions run in the same scheduled Worker cron as push notifications
- The event engine is deliberately generic — Stories 12.2 and 12.3 build specific event types on top of it

**FRs:** FR_EVENT_01

**Dependencies:** None

---

#### Story 12.2: Nazgûl Pursuit Events — Personal Challenges

**Priority:** P1

**Description:** 72-hour personal challenges where users must walk a target distance to "outrun the Nazgûl" — with cosmetic consequences (visual badge) for success or failure.

As a user,
I want to participate in exciting 72-hour personal challenges,
So that I have urgent, time-limited motivation to push my walking further.

**Acceptance Criteria:**

**Given** the event engine exists (Story 12.1)
**When** a Nazgûl Pursuit event is created (admin or system-generated on a recurring schedule)
**Then** users can join the event from an events page or notification
**And** the event has a target distance (e.g., 15 km in 72 hours) and a themed title ("Flee from the Nazgûl!")
**And** during the event, the user's progress is tracked against the goal distance
**And** a progress indicator is displayed on the journey page and events page: distance completed / target, time remaining, a themed progress bar (dark rider approaching visual)
**And** if the user completes the distance before the deadline: they receive a "Nazgûl Evaded" badge/achievement
**And** if the user fails: they receive a "Caught by the Nazgûl" visual indicator (cosmetic only — no punishment, themed humor)
**And** badges/achievements are stored in a new `user_achievements` table: `id`, `user_id` (FK), `achievement_type` (TEXT), `event_id` (FK, nullable), `earned_at`
**And** achievements are displayed on the user's profile and friend profile pages
**And** the events page (`/events`) is created as a new SSR page + Preact island showing active and past events
**And** Nazgûl Pursuit events can be system-generated on a recurring schedule (e.g., weekly) via the scheduled Worker
**And** tests cover: joining, progress tracking, completion, failure, badge assignment, recurring generation

**Technical Notes:**
- Event `type = 'personal'` and `metadata` includes `{ theme: 'nazgul-pursuit', goalDistance: 15, recurringSchedule: 'weekly' }`
- Achievement icons: small WebP images in `public/img/achievements/` (reuse asset pipeline)
- The progress display is a mini-component on the journey page — shows when user has an active personal event
- Badge display: add an achievements section to the profile island and friend profile page
- Auto-generation: the scheduled Worker checks if a Nazgûl Pursuit event should be created this week

**FRs:** FR_EVENT_02

**Dependencies:** Story 12.1 (Event engine)

---

#### Story 12.3: Community Milestones — Global Challenges

**Priority:** P1

**Description:** Global time-limited challenges where all participating users contribute distance toward a community target, with a real-time progress bar visible to all participants.

As a user,
I want to participate in community-wide walking challenges,
So that I feel connected to the larger Walk to Mordor community and contribute to a shared goal.

**Acceptance Criteria:**

**Given** the event engine exists (Story 12.1)
**When** a Community Milestone event is created (admin-created)
**Then** users can join the community event from the events page
**And** the event has a large community target distance (e.g., "Walk to Rivendell Together — 10,000 km") and a deadline
**And** all participants' walked distances during the event period contribute to the community total
**And** a real-time community progress bar is displayed on the events page showing: community total distance, target, participant count, time remaining
**And** the progress bar updates on page load/refresh (polling every 60 seconds or on walk log)
**And** a `GET /api/events/:id/community-progress` endpoint returns `{ totalDistance, targetDistance, participantCount, topContributors: [{ username, avatarId, contribution }] }`
**And** top contributors (top 10 by distance) are displayed on the event detail page
**And** if the community reaches the target, a celebration state is displayed: "The Community has reached [milestone]!" with themed art
**And** participants who contributed receive a community badge/achievement
**And** the leaderboard does NOT show exact distances for privacy — only relative ranking (1st, 2nd, etc.) with the user's own exact contribution shown
**And** tests cover: community progress aggregation, top contributors, completion, badge distribution

**Technical Notes:**
- Community total: `SELECT SUM(progress_distance) FROM event_participants WHERE event_id = ? AND status = 'active'`
- Top contributors: `SELECT ... ORDER BY progress_distance DESC LIMIT 10`
- Real-time feel: poll `GET /api/events/:id/community-progress` every 60 seconds on the event detail page
- Community events are `type = 'community'` in the events table
- Badge: `achievement_type = 'community-milestone-[eventId]'` — one badge per completed community event
- Consider a push notification when the community target is reached

**FRs:** FR_EVENT_03

**Dependencies:** Story 12.1 (Event engine)

---

### Epic 13: AI-Powered Narration

#### Story 13.1: Workers AI Integration & Narration Engine

**Priority:** P1

**Description:** Integrate Cloudflare Workers AI for generating personalized journey narration. Build the server-side narration engine with prompt templates, rate limiting, and response caching.

As a developer,
I want a narration engine powered by Workers AI with proper guardrails,
So that we can generate personalized, cached journey text without excessive AI costs or latency.

**Acceptance Criteria:**

**Given** the app has no AI integration
**When** the Workers AI narration engine is implemented
**Then** Workers AI is configured as a binding in `wrangler.json` (`[ai]` section)
**And** a `src/narration-engine.ts` module is created with a `generateNarration(context: NarrationContext)` function
**And** `NarrationContext` includes: `totalDistance`, `currentMilestone`, `nextMilestone`, `currentStreak`, `lastWalkDistance`, `daysSinceLastWalk`, `fellowshipName?`
**And** prompt templates are stored in code (not DB) with the following structure:
  - System prompt: "You are a narrator in the style of J.R.R. Tolkien, describing a walking journey through Middle-earth…"
  - User context injection: distance, milestone, streak data
  - Output constraints: max 150 words, narrative prose, no modern references, first or third person based on context
**And** generated narrations are cached in a new `narration_cache` table: `id`, `user_id` (FK), `context_hash` (TEXT, UNIQUE per user — hash of key context values), `narration_text` (TEXT), `generated_at`
**And** cache key: hash of `(userId, totalDistance rounded to nearest 5km, currentStreak > 0, currentMilestone.id)` — regeneration only happens on meaningful progress changes
**And** a `GET /api/narration` endpoint returns the current cached narration or generates a new one
**And** rate limit: max 1 generation per user per hour; otherwise serve cached
**And** fallback: if AI generation fails or times out, return a pre-written static narration from a template pool
**And** the endpoint returns `{ narration: string, generatedAt: string, isCached: boolean }`
**And** tests cover: prompt construction, caching logic, rate limiting, fallback behavior, context hashing

**Technical Notes:**
- Workers AI binding: `[ai] binding = "AI"` in `wrangler.json` — access via `env.AI.run(model, { prompt })`
- Model: start with `@cf/meta/llama-3.1-8b-instruct` (free tier, good at creative writing)
- Context hash ensures we don't regenerate for trivial changes — only meaningful progress triggers new content
- Pre-written fallback pool: 20–30 static narrations for different journey segments (Shire, Bree, Rivendell, etc.)
- The 150-word limit keeps generation fast and consistent

**FRs:** FR_AI_01, FR_AI_02 | **NFRs:** NFR_AI_01

**Dependencies:** None

---

#### Story 13.2: Journey Narration UI

**Priority:** P1

**Description:** Display the AI-generated narration on the journey page as an immersive reading experience, styled as a parchment scroll or journal entry.

As a user,
I want to read personalized journey narration that changes with my progress,
So that my daily walking experience feels like a real journey through Middle-earth.

**Acceptance Criteria:**

**Given** the narration engine exists (Story 13.1) and returns narration text
**When** the user visits the journey page
**Then** a narration card is displayed prominently on the page (below the progress bar, above the calendar)
**And** the card is styled as a parchment/scroll with a Tolkien-esque visual treatment (aged paper texture background, serif font, muted gold border)
**And** the narration text is displayed with appropriate typography (line height, font size optimized for reading)
**And** if the narration is new (generated since last visit), a subtle "new" indicator or animation is shown
**And** a "Refresh Narration" button allows the user to request a new generation (respects rate limit — disabled with "Available in X minutes" if on cooldown)
**And** the narration loads asynchronously — a loading skeleton is shown while fetching
**And** if narration is unavailable (API error or no data), the card shows gracefully with a static quote ("Not all those who wander are lost…")
**And** the narration card is collapsible (user can minimize it if they prefer a data-focused view)
**And** collapse state persists to localStorage
**And** the narration card is responsive and readable on mobile (min font size 16px, adequate padding)
**And** tests cover: rendering states (loading, narration, error, collapsed), refresh behavior, rate limit UX

**Technical Notes:**
- Implement as a Preact component `NarrationCard` rendered on the journey page
- Fetch from `GET /api/narration` on mount; show skeleton during load
- The "new" detection: compare `generatedAt` from API vs. `lastSeenNarrationAt` in localStorage
- Parchment styling: use a CSS background with a subtle texture image or gradient (no heavy images — keep it light)
- Collapsible: CSS transition with max-height animation, controlled by a signal

**FRs:** FR_AI_01

**Dependencies:** Story 13.1 (Narration engine)

---

### Epic 14: Distance Lending — Shadowfax Express

#### Story 14.1: Shadowfax Express Schema & API

**Priority:** P1

**Description:** Create the distance lending system where friends can gift surplus kilometers to struggling companions, with caps per transaction, daily cooldowns, and fellowship context.

As a user,
I want to gift some of my walked distance to a friend who's falling behind,
So that I can help my friend reach their next milestone and we support each other.

**Acceptance Criteria:**

**Given** the user has friends (accepted friendships exist)
**When** the distance lending system is implemented
**Then** a new `distance_transfers` table is created: `id`, `sender_id` (FK → users.id), `receiver_id` (FK → users.id), `amount` (DECIMAL), `fellowship_id` (FK → parties.id, nullable — for fellowship-context transfers), `message` (TEXT, nullable, max 100 chars), `created_at`
**And** `POST /api/friends/:userId/lend` — send distance. Body: `{ amount: number, message?: string, fellowshipId?: number }`.
**And** constraints enforced:
  - Sender and receiver must be accepted friends
  - `amount` must be > 0 and ≤ 50 km per transaction (configurable cap)
  - Sender must have logged at least `amount` km in the past 7 days (can't lend distance you didn't walk)
  - Daily limit: max 100 km total sent per day per sender
  - Daily limit: max 100 km total received per day per receiver
  - Cooldown: 1 transfer to the same friend per 24 hours
  - If `fellowshipId` provided: validate both sender and receiver are active members
**And** on successful transfer: the receiver's `totalDistance` increases by `amount` (insert a `progress` entry with a special marker or add to existing day's entry)
**And** the sender's distance is NOT reduced — lending is a "gift of surplus effort," not a transfer
**And** the receiver is notified via push notification (if subscribed): "[Username] sent you X km via Shadowfax Express! [optional message]"
**And** `GET /api/friends/:userId/lending-status` returns: `{ canLend: boolean, dailySentTotal: number, dailyReceivedTotal: number, lastTransferTo: timestamp, cooldownRemainingSeconds: number }`
**And** `GET /api/transfers` — list the user's recent transfers (sent and received), paginated
**And** added distance is attributed with `source = 'gift'` so it can be distinguished in stats (does not count for streaks or personal records)
**And** tests cover: all constraints, edge cases (lending to self, over-cap, cooldown), progress update, notification

**Technical Notes:**
- The "surplus" check: `SELECT SUM(distance) FROM progress WHERE user_id = sender_id AND date >= date('now', '-7 days')` must be ≥ `amount`
- Gifted distance in `progress` table: add a `source` TEXT column (default 'walk', also 'gift') or use a separate `progress_gifts` table to avoid polluting the progress table — prefer a separate table for cleanliness
- Alternative: `progress_gifts` table (id, receiver_id, sender_id, transfer_id, amount, date, created_at) that gets summed with `progress` in `totalDistance` queries
- Push notification: reuse the `sendPushNotification(userId, payload)` utility from Epic 11
- The "Shadowfax Express" name should appear in the UI and notifications for thematic flavor

**FRs:** FR_LEND_01

**Dependencies:** None (push notifications for delivery are optional — graceful degradation if Epic 11 not shipped)

---

#### Story 14.2: Distance Lending UI

**Priority:** P1

**Description:** Build the UI for sending distance to friends, viewing lending history, and receiving gift notifications — integrated into the friend profile page and a dedicated lending section.

As a user,
I want a clear UI to send distance to my friends and see my lending history,
So that the experience of helping friends is enjoyable and transparent.

**Acceptance Criteria:**

**Given** the lending API exists (Story 14.1)
**When** the user views a friend's profile page (`/friends/:id`)
**Then** a "Send Distance" / "Shadowfax Express" section is displayed if the friend is an accepted friend
**And** a distance input allows entering the amount to lend (with the current cap and cooldown status displayed)
**And** an optional message input (max 100 chars) is available
**And** if the user is in a shared fellowship with the friend, a fellowship selector appears to associate the gift
**And** a "Send" button triggers the transfer with a confirmation dialog: "Send X km to [friend]? (This won't reduce your distance)"
**And** on success, a themed confirmation is shown ("Shadowfax rides! X km delivered to [friend]!")
**And** on cooldown, the button is disabled with "Available in X hours"
**And** on validation failure (insufficient surplus, cap exceeded), a clear error message is shown

**Given** the user wants to view their lending history
**When** the user navigates to a "Shadowfax Express" section (accessible from profile or a new nav item)
**Then** a list of recent transfers is shown: sent transfers ("You sent X km to [friend]") and received ("You received X km from [friend]"), with timestamps and optional messages
**And** totals are shown: "Total gifted: X km" and "Total received: X km"

**And** the UI is responsive and follows existing design patterns
**And** tests cover: send flow, confirmation, error states, history display

**Technical Notes:**
- The "Send Distance" section on friend profile is a component within the existing `FriendProfileIsland`
- History view could be a section on the profile page or a standalone page `/transfers`
- The "Shadowfax Express" branding adds thematic charm — use a horse icon or related imagery
- Surplus display: show "You've walked X km this week — you can send up to Y km"

**FRs:** FR_LEND_01

**Dependencies:** Story 14.1 (Lending API)

---

### Epic 15: Cross-Fellowship Alliances

#### Story 15.1: Alliance System Schema & API

**Priority:** P1

**Description:** Enable two fellowships to form a temporary alliance for mega-challenges, combining their distances toward a shared event goal.

As a fellowship leader,
I want to ally my fellowship with another to tackle mega-challenges together,
So that we can pool our walking efforts for massive community goals.

**Acceptance Criteria:**

**Given** the event engine exists (Epic 12) with community events
**When** the alliance system is implemented
**Then** a new `alliances` table is created: `id`, `event_id` (FK → events.id, CASCADE), `party_a_id` (FK → parties.id), `party_b_id` (FK → parties.id), `proposed_by` (FK → users.id — must be leader of party_a), `status` (TEXT: 'pending' | 'active' | 'completed' | 'dissolved'), `created_at`, `accepted_at` (DATETIME, nullable)
**And** UNIQUE constraint on `(event_id, party_a_id, party_b_id)` (normalize: smaller id first)
**And** `POST /api/alliances` — propose alliance. Body: `{ eventId: number, targetPartyId: number }`. Proposer must be leader of their party. Both parties must have joined the event.
**And** `POST /api/alliances/:id/accept` — accept alliance proposal. Only the leader of the target party can accept.
**And** `POST /api/alliances/:id/decline` — decline proposal. Only the target party leader.
**And** `GET /api/alliances?eventId=X` — list alliances for an event (active and pending for the user's parties)
**And** `GET /api/alliances/:id/progress` — combined alliance progress: sum of both parties' event contributions
**And** alliance progress is computed as the sum of both parties' `event_participants.progress_distance` for the allied event
**And** alliances auto-dissolve when the event ends (status → 'completed' or 'dissolved')
**And** a party can only have one active alliance per event
**And** the combined alliance progress is displayed on the event detail page for allied participants
**And** tests cover: proposal flow, accept/decline, progress calculation, auto-dissolution, uniqueness constraints

**Technical Notes:**
- Alliance progress is derived, not stored — computed from `event_participants` for both parties' members
- Normalization: always store `party_a_id < party_b_id` to prevent `(A,B)` and `(B,A)` duplicates
- Alliance lifecycle is tied to the event lifecycle — no standalone alliances outside events
- Mega-challenges are community events with higher targets designed for alliances

**FRs:** FR_ALLIANCE_01

**Dependencies:** Epic 12 Story 12.1 (Event engine)

---

#### Story 15.2: Alliance UI & Mega-Challenge Integration

**Priority:** P1

**Description:** Build the UI for proposing, accepting, and viewing alliances within the events experience, plus a combined alliance progress visualization.

As a user,
I want to see alliance proposals, combined progress, and ally details within events,
So that the cross-fellowship teamwork feels tangible and exciting.

**Acceptance Criteria:**

**Given** the alliance API exists (Story 15.1) and a community event is active
**When** a fellowship leader views the event detail page
**Then** an "Ally with another Fellowship" button is shown (leader only, if no active alliance for this event)
**And** clicking shows a selector of other participating fellowships (name, member count, current event progress)
**And** selecting a fellowship and confirming sends an alliance proposal

**Given** a fellowship leader has a pending incoming alliance proposal
**When** they view the event detail page
**Then** a notification banner shows: "[Fellowship Name] wants to ally with you for this challenge!"
**And** "Accept" and "Decline" buttons are available
**And** on accept, the alliance becomes active and both parties see combined progress

**Given** an active alliance exists for an event
**When** any member of either allied fellowship views the event detail page
**Then** a combined alliance progress bar is shown alongside individual fellowship progress
**And** both fellowship names and their individual contributions are displayed
**And** an "Alliance" badge/banner is visible on the event card

**And** pending alliance proposals are visible to leaders in the fellowship management page
**And** the events page shows alliance status on event cards
**And** tests cover: proposal UI, accept/decline, combined progress display, leader-only actions

**Technical Notes:**
- Alliance UI is part of the events island — add alliance components to `EventDetailIsland`
- Combined progress bar: two-tone fill (each party's contribution in their color) stacked on the same bar
- The fellowship selector filters to parties participating in the same event

**FRs:** FR_ALLIANCE_01

**Dependencies:** Story 15.1 (Alliance API), Epic 12 Story 12.2 or 12.3 (Events UI context)

---

### Epic 16: Milestone Content — Campfire Stories & Lore

#### Story 16.1: Milestone Content Schema & Admin Management

**Priority:** P0 (Blocker for content stories)

**Description:** Create the milestone content schema and admin interface for managing authored lore content (stories, poetry, appendices) linked to milestones.

As an admin,
I want to manage rich content attached to milestones,
So that I can add, edit, and organize campfire stories, poetry, and appendices for users to discover.

**Acceptance Criteria:**

**Given** no milestone content infrastructure exists beyond goal descriptions
**When** the milestone content system is implemented
**Then** a new `milestone_content` table is created: `id`, `goal_id` (FK → goals.id, CASCADE), `type` (TEXT: 'story' | 'poetry' | 'appendix'), `title` (TEXT), `body` (TEXT — Markdown), `author_attribution` (TEXT, nullable — for Tolkien quotes/references), `sort_order` (INTEGER — for ordering within a milestone), `created_at`, `updated_at`
**And** UNIQUE constraint on `(goal_id, type, sort_order)` to prevent ordering collisions
**And** admin API endpoints:
  - `GET /api/admin/milestones/:goalId/content` — list content for a milestone
  - `POST /api/admin/milestones/:goalId/content` — create content entry
  - `PUT /api/admin/milestones/:goalId/content/:id` — update content entry
  - `DELETE /api/admin/milestones/:goalId/content/:id` — delete content entry
**And** public API endpoints:
  - `GET /api/goals/:goalId/content` — list content for an unlocked milestone. Returns 403 if the milestone is locked for the user (distance not reached). Returns empty array if no content exists.
**And** admin UI: on the goal edit page (`/admin/goals/:id`), add a "Content" tab/section showing content list with create/edit/delete controls
**And** content editor uses a Markdown textarea with preview (matching existing goal description editor pattern)
**And** each content entry has a type badge (Story 📖, Poem 📜, Appendix 📚) in the admin list
**And** tests cover CRUD endpoints, access control (locked milestone check), admin UI interactions

**Technical Notes:**
- The Markdown body is rendered client-side (existing libraries or simple Markdown-to-HTML converter)
- Type-specific styling will be handled in Story 16.2 — this story focuses on schema + admin
- `sort_order` allows multiple stories/poems per milestone, ordered intentionally
- Content is strictly tied to goals — no standalone content outside the milestone system
- Lore compliance: admin is responsible for content accuracy (no automated validation)

**FRs:** FR_CONTENT_01, FR_CONTENT_02, FR_CONTENT_03 (schema/admin portion)

**Dependencies:** None (builds on existing admin portal and goal management)

---

#### Story 16.2: Campfire Stories & Poetry Display

**Priority:** P1

**Description:** Display campfire stories (150-word lore snippets) and poetry at unlocked milestones with immersive, type-appropriate styling.

As a user,
I want to read campfire stories and poetry unlocked at milestones,
So that reaching milestones feels rewarding with rich Tolkien-inspired content.

**Acceptance Criteria:**

**Given** milestone content of type 'story' or 'poetry' exists for a reached milestone
**When** the user opens the GoalModal for that milestone
**Then** a "Content" tab or section is displayed within the modal (alongside the existing image and description)
**And** campfire stories render with a warm, storytelling visual treatment: aged-parchment background, serif font, decorative border
**And** poetry renders with centered text, italicized lines, and stanza spacing
**And** if multiple content entries exist for the milestone, they are displayed in `sort_order` sequence with type badges
**And** content loads from `GET /api/goals/:goalId/content` when the GoalModal opens
**And** a loading skeleton is shown while content fetches
**And** if no content exists for the milestone, the content tab/section is hidden (no empty state)
**And** Markdown body is rendered as safe HTML (sanitized — no script injection)
**And** on the journey page goals list, unlocked goals with content show a subtle indicator icon (📖) to signal content is available
**And** the content discovery indicator counts toward the NFR_CONTENT_01 success metric (> 60% click-through)
**And** the styling follows the dark fantasy theme and is responsive on mobile
**And** tests cover: content display, type-specific styling, Markdown rendering, empty state, loading state

**Technical Notes:**
- Markdown rendering: use a lightweight library (e.g., `marked` or `snarkdown`) compiled into the island bundle
- HTML sanitization critical: use DOMPurify or equivalent to prevent XSS from Markdown content
- The content indicator (📖 icon) on goal cards can be a simple check: cache whether content exists per goal in the goals list API response (add `has_content: boolean` to `GET /api/goals` response)
- Poetry rendering: detect `type === 'poetry'` and apply CSS class with centered text and increased line-height

**FRs:** FR_CONTENT_01, FR_CONTENT_02 | **NFRs:** NFR_CONTENT_01

**Dependencies:** Story 16.1 (Content schema)

---

#### Story 16.3: Appendices Deep Dives

**Priority:** P2

**Description:** Extended lore essays at milestones that provide deep-dive content for dedicated Tolkien fans — longer-form reads with section structure.

As a user,
I want to read in-depth lore essays at milestones,
So that I can deeply engage with the world of Middle-earth as I walk through it.

**Acceptance Criteria:**

**Given** milestone content of type 'appendix' exists for a reached milestone
**When** the user opens the GoalModal for that milestone
**Then** appendix entries appear in the content section alongside stories and poetry (ordered by `sort_order`)
**And** appendices render with a structured layout: title, body with Markdown headings/sections, and author attribution if present
**And** long appendices (> 500 words) show a "Read more" truncation with expand toggle
**And** appendix styling is distinct from stories: more academic/reference feel (clean sans-serif body, clear heading hierarchy, subtle left-border for block quotes)
**And** attribution line renders below the body when present (e.g., "— From the appendices of *The Lord of the Rings*")
**And** tests cover: appendix rendering, truncation, expand/collapse, attribution

**Technical Notes:**
- Appendices use the same `milestone_content` table and display pipeline as stories and poetry — differentiated by `type = 'appendix'` and CSS classes
- The Markdown renderer (from Story 16.2) handles headings, lists, and block quotes which appendices will heavily use
- Truncation: client-side via CSS `max-height` with overflow hidden + "Read more" toggle (no server-side truncation)

**FRs:** FR_CONTENT_03 | **NFRs:** NFR_CONTENT_01

**Dependencies:** Story 16.2 (Content display)

---

### Epic 17: Milestone Content — Field Guide

#### Story 17.1: Field Guide Content Schema & Admin

**Priority:** P1

**Description:** Create the field guide content type — illustrated naturalist's sketchbook entries about Middle-earth flora and fauna, linked to regional milestones.

As an admin,
I want to manage field guide entries tied to geographic regions,
So that users discover flora and fauna content as they walk through different parts of Middle-earth.

**Acceptance Criteria:**

**Given** no field guide infrastructure exists
**When** the field guide system is implemented
**Then** a new `field_guide_entries` table is created: `id`, `goal_id` (FK → goals.id, CASCADE), `name` (TEXT — species/plant name), `category` (TEXT: 'flora' | 'fauna'), `description` (TEXT — Markdown), `illustration_id` (TEXT, nullable — image slug following `image_id` convention), `region` (TEXT — geographic area name like "The Shire", "Fangorn"), `rarity` (TEXT: 'common' | 'uncommon' | 'rare'), `sort_order` (INTEGER), `created_at`, `updated_at`
**And** admin API endpoints:
  - `GET /api/admin/field-guide` — list all entries with filter by region/category
  - `POST /api/admin/field-guide` — create entry
  - `PUT /api/admin/field-guide/:id` — update entry
  - `DELETE /api/admin/field-guide/:id` — delete entry
**And** public API endpoints:
  - `GET /api/field-guide` — list all unlocked entries for the user (entries whose linked milestone has been reached). Grouped by region.
  - `GET /api/field-guide/:id` — single entry detail (403 if linked milestone not reached)
**And** illustrations follow the existing asset pipeline: `public/img/field-guide/{illustration_id}.webp` and `public/img/field-guide/thumbs/{illustration_id}-thumb.webp`
**And** admin UI: a new "Field Guide" section in the admin portal with CRUD interface
**And** documentation in `docs/data-models.md` covers the schema
**And** tests cover CRUD, access control, region filtering

**Technical Notes:**
- Field guide is a separate table (not `milestone_content`) because it has unique fields (category, rarity, illustration, region)
- Illustrations use the same WebP optimization pipeline as goal images
- `region` is a display label — not enforced by FK; allows flexible geographic naming
- Rarity is a cosmetic classification — "rare" entries could get special visual treatment

**FRs:** FR_CONTENT_04

**Dependencies:** None

---

#### Story 17.2: Field Guide Discovery UI

**Priority:** P1

**Description:** Create the Field Guide browsing experience — a collectible-feeling, illustrated catalog accessible from navigation.

As a user,
I want to browse a beautiful field guide of Middle-earth flora and fauna I've discovered,
So that my walking journey feels like exploring a real naturalist's expedition.

**Acceptance Criteria:**

**Given** field guide entries exist and the user has unlocked some via walking distance
**When** the user navigates to `/field-guide`
**Then** a Field Guide page is displayed with entries grouped by region (e.g., "The Shire", "Bree-land", "Rivendell")
**And** each region section shows discovered entries as illustrated cards: illustration thumbnail, name, category badge (🌿 Flora / 🦌 Fauna), rarity indicator
**And** undiscovered entries (in regions the user hasn't reached) are shown as silhouetted/locked cards with "???" name and the distance needed to unlock
**And** clicking a discovered entry opens a detail view with: full illustration, name, description (rendered Markdown), region, rarity, and category
**And** a "Collection Progress" indicator shows: "X of Y species discovered" with a progress ring
**And** filtering is available by category (Flora / Fauna / All) and rarity
**And** a "Field Guide" link is added to the DrawerIsland navigation (with a count badge showing new unlocked entries since last visit)
**And** the page is implemented as an SSR shell + Preact island following existing patterns
**And** the Field Guide page loads its own stylesheet (`public/css/field-guide.css`)
**And** responsive: on mobile, cards are in a single-column list; on desktop, a 2–3 column grid
**And** tests cover: page rendering, locked/unlocked states, filtering, collection progress, detail view

**Technical Notes:**
- Illustrations load lazily (same blur-up pattern as goal images)
- The silhouetted/locked card effect: CSS `filter: brightness(0)` on the illustration with `???` overlay
- "New unlocks" badge: compare user's `totalDistance` against field guide entry milestone distances to detect newly-reachable entries since last visit (track `last_field_guide_visit_distance` in user preferences or localStorage)
- Collection progress: `unlocked / total` from the API response

**FRs:** FR_CONTENT_04 | **NFRs:** NFR_CONTENT_01

**Dependencies:** Story 17.1 (Field Guide schema)

---

### Epic 18: Milestone Content — Milestone Journals

#### Story 18.1: Journal Schema & API

**Priority:** P1

**Description:** Create a journaling system where users can write personal entries at milestones they've reached, with visibility to friends.

As a user,
I want to write a personal journal entry when I reach a milestone,
So that I can reflect on my journey and share my thoughts with friends.

**Acceptance Criteria:**

**Given** no journal infrastructure exists
**When** the journal system is implemented
**Then** a new `milestone_journals` table is created: `id`, `user_id` (FK → users.id, CASCADE), `goal_id` (FK → goals.id), `body` (TEXT, max 2000 chars), `visibility` (TEXT: 'private' | 'friends'), `created_at`, `updated_at`
**And** UNIQUE constraint on `(user_id, goal_id)` — one journal entry per user per milestone
**And** API endpoints:
  - `POST /api/journals` — create journal entry. Body: `{ goalId, body, visibility }`. User must have reached the milestone (total distance ≥ goal distance). Returns 400 if milestone not reached.
  - `PUT /api/journals/:id` — update journal entry. Only the author can update.
  - `DELETE /api/journals/:id` — delete journal entry. Only the author can delete.
  - `GET /api/journals/mine` — list all the user's own journal entries
  - `GET /api/journals/friends?goalId=X` — list friends' journal entries for a specific milestone (only entries with `visibility = 'friends'` from accepted friends)
  - `GET /api/goals/:goalId/journals` — direct access to friends' journals for a specific goal (alias for above)
**And** journal body is plain text (no Markdown, no HTML — user-generated content safety)
**And** body is sanitized/escaped on storage and display (XSS prevention)
**And** the API validates that `body` is non-empty and ≤ 2000 characters
**And** tests cover: CRUD, access control (milestone check, author-only, friends-only visibility), character limits, sanitization

**Technical Notes:**
- Plain text only for user-generated content — avoids moderation complexity of rich content
- `visibility = 'friends'` entries are visible to users who are accepted friends AND have also reached that milestone (double gate: friendship + milestone distance)
- Alternatively, friends can see journal entries regardless of their own progress — design decision for Hayden. Currently specced as friendship-only gate (not milestone gate for readers).
- The `GET /api/journals/friends?goalId=X` endpoint joins `milestone_journals` with `friendships` to filter

**FRs:** FR_CONTENT_05

**Dependencies:** None

---

#### Story 18.2: Journal UI & Friend Visibility

**Priority:** P1

**Description:** Build the journaling interface — write entries at milestones, browse own journals, and read friends' journal entries at shared milestones.

As a user,
I want to write journal entries at milestones and read what my friends wrote,
So that milestones become shared storytelling moments in our journey.

**Acceptance Criteria:**

**Given** the journal API exists (Story 18.1)
**When** the user opens the GoalModal for a reached milestone
**Then** a "Write a Journal Entry" section is displayed if no entry exists yet
**And** a textarea (max 2000 chars with character counter) and visibility toggle (Private / Friends) are shown
**And** a "Save" button submits the entry and confirms with a success message
**And** if an entry already exists, it displays in read mode with "Edit" and "Delete" buttons
**And** editing opens the textarea with existing content

**Given** friends have written journal entries for the same milestone
**When** the GoalModal is open for that milestone
**Then** a "Friends' Journals" section shows entries from friends (visibility = 'friends')
**And** each entry shows: friend's avatar, username, entry text, and date written
**And** entries are ordered by date (newest first)
**And** if no friends have written entries, the section is hidden (no empty state)

**Given** the user wants to browse all their journal entries
**When** the user navigates to a "My Journal" section (accessible from profile or navigation)
**Then** a chronological list of the user's journal entries is displayed with: milestone name, milestone image thumbnail, entry excerpt, date written, visibility badge
**And** clicking an entry opens the full GoalModal for that milestone

**And** journal entries use appropriate typography (serif font, readable line-height)
**And** visibility is clearly indicated: 🔒 Private / 👥 Friends
**And** the UI is responsive and accessible
**And** tests cover: write flow, edit/delete, friends' entries display, journal list browsing

**Technical Notes:**
- The journal writing section is added to the existing GoalModal component
- Friends' journals: fetch from `GET /api/goals/:goalId/journals` when GoalModal opens for a reached milestone
- "My Journal" could be a section on the profile page or a standalone `/journals` page
- Character counter: live update as user types, red warning at > 1900 chars
- Plain text display: use `white-space: pre-wrap` for line breaks

**FRs:** FR_CONTENT_05 | **NFRs:** NFR_CONTENT_01

**Dependencies:** Story 18.1 (Journal API)

---

## Summary

| Epic | Phase | Stories | Priority Range | Dependencies |
|------|-------|---------|----------------|--------------|
| Epic 7: Developer Experience | 4 | 3 | P1–P2 | None |
| Epic 8: Architecture & Performance | 5 | 3 | P1 | None |
| Epic 9: Journey UX Enhancement | 6 | 2 | P1 | None |
| Epic 10: Stats, Insights & Offline | 7 | 4 | P1–P2 | Epic 8 (Story 10.4 depends on 8.3) |
| Epic 11: Push Notifications | 8 | 3 (1 cancelled) | P0–P2 | None (internal: 11.2–11.3 depend on 11.1) |
| Epic 12: Events & Challenges | 9 | 3 | P0–P1 | None (internal: 12.2–12.3 depend on 12.1) |
| Epic 13: AI Narration | 10 | 2 | P1 | None (internal: 13.2 depends on 13.1) |
| Epic 14: Distance Lending | 11 | 2 | P1 | None (internal: 14.2 depends on 14.1) |
| Epic 15: Cross-Fellowship Alliances | 12 | 2 | P1 | Epic 12 (Event engine) |
| Epic 16: Campfire Stories & Lore | 13 | 3 | P0–P2 | None (internal: 16.2–16.3 depend on 16.1) |
| Epic 17: Field Guide | 14 | 2 | P1 | None (internal: 17.2 depends on 17.1) |
| Epic 18: Milestone Journals | 15 | 2 | P1 | None (internal: 18.2 depends on 18.1) |
| **Total** | | **31** (1 cancelled) | | |

### Dependency Map

```
Epic 7  ─── independent
Epic 8  ─── independent
Epic 9  ─── independent
Epic 10 ──→ Epic 8 (Story 10.4 needs SW intercept from 8.3)
Epic 11 ─── independent
Epic 12 ─── independent
Epic 13 ─── independent
Epic 14 ─── independent (push from Epic 11 is optional enhancement)
Epic 15 ──→ Epic 12 (Alliance needs event engine from 12.1)
Epic 16 ─── independent
Epic 17 ─── independent
Epic 18 ─── independent
```

### Recommended Implementation Order

1. **Epic 7** — Developer Foundation (improves DX for everything that follows)
2. **Epic 8** — Architecture & Performance (establishes patterns used by later epics)
3. **Epic 9** — Journey UX (quick wins, high user-visible impact)
4. **Epic 10** — Stats & Offline (leverages Epic 8 SWR pattern)
5. **Epic 11** — Push Notifications (infrastructure + engagement features)
6. **Epic 12** — Events & Challenges (creates event engine)
7. **Epic 13** — AI Narration (standalone, high novelty value)
8. **Epic 14** — Distance Lending (social mechanic, benefits from push)
9. **Epic 15** — Alliances (builds on event engine from Epic 12)
10. **Epics 16, 17, 18** — Content waves (parallelizable, can start anytime after admin portal exists)
