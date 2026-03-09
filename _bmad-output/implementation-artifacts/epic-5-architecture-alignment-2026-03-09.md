# Epic 5 Alignment Review: Races

Date: 2026-03-09  
Analyst: Bob (Scrum Master) with support from Mary (Analyst), Winston (Architect), Amelia (Dev), and Quinn (QA)  
Scope: Compare Epic 5 in `_bmad-output/planning-artifacts/epics.md` against the current post-Epic-4 codebase state

## Executive Summary

Verdict: **No-Go As Written**

Epic 5 is still the right next feature area, but the current epic plan no longer matches the live repository closely enough to start implementation safely.

The codebase is technically capable of supporting races. The Worker monolith, D1 patterns, SSR-plus-islands architecture, admin auth guardrails, and party-era sharing logic are all strong enough to support the feature without foundational rewrites.

The blockers are alignment blockers, not platform blockers:

- The entrant model is unresolved. The PRD still frames races as challenge functionality between users and parties, but the planned schema only models user participation.
- The admin baseline is stale. The live codebase now contains admin users and admin metrics pages, islands, and tests, but the main docs and route map still reflect an older, smaller admin surface.
- The leaderboard contract is internally inconsistent. The plan wants a 5-minute cache but also wants 60-second UI refreshes and current-user context in standings.
- Privacy and visibility rules are missing. The app is private-by-default, and Epic 5 currently does not define who can discover races or view race standings.

Epic 5 should be re-aligned before story execution begins.

## Current-State Deltas

### What the current codebase already supports well

- Manual Worker route dispatch with strong existing patterns for exact and parameterized route handling
- SSR page shells via `renderLayout()` with one-island-per-page patterns
- Authenticated public APIs and admin-prefixed APIs with centralized admin validation
- Admin audit logging for privileged mutations
- Party-era progress logic that already computes derived standings from total-distance baselines
- Existing leaderboard-like UI patterns in admin metrics

### What has drifted since the original Epic 5 plan

1. **Admin surface drift**
   - `docs/architecture.md` documents dashboard and goals admin routes, but the live codebase also contains admin users and admin metrics page renderers and islands.
   - `src/renderAdminPage.ts` still shows Users and Metrics as disabled "Soon" links.
   - Separate `renderAdminUsersPage.ts` and `renderAdminMetricsPage.ts` files already exist.
   - `client/src/index.tsx` already registers `AdminUsersListIsland` and `AdminMetricsIsland`.
   - The docs do not reflect this state clearly enough.

2. **Routing and tests are out of sync in places**
   - The current Worker router still explicitly wires the documented admin goals/dashboard/image routes.
   - Existing UI tests expect `/admin/users`, `/admin/metrics`, and related admin API paths as part of the available surface.
   - That means some living documentation and some automation are ahead of the route map, while the main architecture docs are behind it.

3. **Race plan assumptions are now too simple**
   - The party system already supports shared progress, leave semantics, activity history, and per-party milestone state.
   - The Epic 5 plan still models races as a basic user participation table plus a leaderboard.
   - That is no longer enough detail for this codebase.

## Architecture Readiness

### Strengths

1. **Database and handler patterns are reusable**
   - Fellowship migrations already demonstrate the right shape for D1 schema work: explicit tables, constraints, and composite indexes.
   - Join/leave and per-user baseline logic already exist in the party model and can inform race baseline design.

2. **Frontend delivery pattern is established**
   - SSR shell plus one island is the dominant pattern for new page work.
   - `/races` and `/races/:id` fit this architecture well.

3. **Admin authorization and audit conventions already exist**
   - Admin race operations can reuse `validateAdminSession` and `admin_audit_log`.
   - No new admin auth mechanism is needed.

4. **Leaderboard-style UI concepts already exist**
   - `AdminMetricsIsland` already renders range-based leaderboard and timeline views.
   - That gives Epic 5 reusable UI and fetch patterns for standings.

### Risks

1. **Manual route topology increases blast radius**
   - The Worker still depends on hand-ordered route checks.
   - Race routes such as `/api/races/:id`, `/api/races/:id/leaderboard`, `/races`, and `/races/:id` will need explicit ordering discipline.

2. **Stored race status may drift from date windows**
   - The current plan wants `status` on the `races` table.
   - Unless the status transition model is defined precisely, duplicated temporal state will drift from `start_date` and `end_date`.

3. **Cache design is not settled**
   - The service worker intentionally does not cache API responses.
   - There is no existing server-side cache pattern in `src/` for dynamic standings data.
   - A 5-minute leaderboard cache needs explicit scope and invalidation rules.

4. **Privacy model is undefined for competition**
   - The app is private-by-default.
   - Party preview is intentionally limited while active party progress is member-gated.
   - Race discovery and race leaderboard visibility need the same level of deliberate access design.

## Product and Scope Gaps

### Unresolved decisions

1. **Who can race?**
   - Users only
   - Parties only
   - Both users and parties

2. **Who can view races and standings?**
   - All authenticated users
   - Participants only
   - Public discovery, private standings
   - Some other privacy model

3. **What identity is displayed?**
   - The current user model clearly has `username` and `email`.
   - The plan asks for `display_name`, which is not currently modeled in the documented schema.

4. **What is the product meaning of trend?**
   - Story 5.6 wants up/down trend indicators.
   - No current data model in Epic 5 defines the source of trend data.

5. **What is the product meaning of race goal?**
   - Story 5.6 wants a progress bar toward a race goal.
   - Story 5.1 does not currently define any race target field.

## Per-Story Assessment

| Story | Current Fit | Main Gaps | Required Updates | Risk |
|---|---|---|---|---|
| 5.1 Race Database Schema | Partial | User-only participant model may conflict with PRD users/parties framing; status field may drift; no support for trend or optional race goal | Decide entrant model first; define whether status is stored or derived; add uniqueness and lifecycle semantics; add optional target model only if UI requires it | High |
| 5.2 Race Management API (Admin) | Partial | API-only scope undershoots likely admin portal needs; audit logging not called out; admin docs are stale | Decide whether `/admin/races*` UI is in scope; require admin audit logging; align with real admin topology before implementation | High |
| 5.3 Race Join & Leave API | Partial | Overlaps conceptually with 5.4 on standings; join/leave/rejoin semantics too loose | Split metadata from standings; define late join, leave after start, rejoin, and cancellation semantics | High |
| 5.4 Race Leaderboard API | Partial | Cache requirement conflicts with auto-refresh and personalized current-user context | Define shared vs personalized payload shape; either remove cache for first pass or specify cache scope and invalidation precisely | High |
| 5.5 Race UI - Discovery & Join | Good | Needs explicit SSR shell + island pattern, drawer/navigation placement, and discovery privacy rules | State page-shell/island ownership, navigation entry point, empty states, and auth/privacy behavior | Medium |
| 5.6 Race UI - Leaderboard & Progress | Partial | Depends on unresolved leaderboard contract, race goal field, and trend source | Make it depend on finalized 5.4; split baseline standings from enhancements like trend and progress goal if needed | High |

## Critical Inconsistencies To Resolve

1. **PRD vs Epic plan**
   - PRD: races are challenge functionality between users and parties
   - Epic plan: `race_participants` only models `user_id`

2. **Leaderboard freshness**
   - Story 5.4: cache leaderboard for 5 minutes
   - Story 5.6: auto-refresh every 60 seconds

3. **Schema vs UI promises**
   - Story 5.6 promises trend and progress toward a race goal
   - Story 5.1 does not define the fields or supporting data needed for those features

4. **Identity contract**
   - Story 5.4 wants user display name
   - Current documented schema centers on `username` and `email`

5. **Admin current-state mismatch**
   - Main dashboard still presents Users and Metrics as future placeholders
   - Separate Users and Metrics pages and islands already exist in the codebase
   - Docs and route assumptions need reconciliation before Epic 5 extends the admin portal further

## Must-Do Checklist Before Epic 5 Starts

1. Decide and document the entrant model.
   - User-only for now, or true user-and-party races.

2. Rewrite Story 5.1 around the real race lifecycle.
   - Join uniqueness
   - Leave/disqualification state
   - Cancellation/archive behavior
   - Derived versus stored status

3. Decide the admin management scope explicitly.
   - API-only by intentional choice, or full `/admin/races*` surfaces.

4. Split race metadata from standings ownership.
   - `GET /api/races/:id` should not ambiguously duplicate leaderboard responsibility if 5.4 owns standings.

5. Redefine the leaderboard cache contract.
   - Shared payload only, or no cache initially.
   - Do not mix race-wide caching with user-specific position semantics without a clear design.

6. Define privacy and visibility rules.
   - Discovery visibility
   - Standings visibility
   - Identity exposure as part of participation consent

7. Refresh living docs before execution.
   - `docs/architecture.md`
   - `docs/ui-overview.md`
   - `docs/frontend-guide.md`
   - `docs/api-reference.md`

8. Create the missing admin test bootstrap.
   - Epic 4 already identified this as prerequisite work.
   - Race admin stories should not start with the same UI/E2E deferral pattern.

## Recommended Sequence Update

Recommended order:

1. Epic 5 alignment refresh and documentation update
2. 5.1 Race schema after entrant model decision
3. 5.2 Admin management foundation with explicit admin-surface decision
4. 5.3 Join/leave flows with finalized lifecycle rules
5. 5.4 Live leaderboard first, cache only if contract is clear
6. 5.5 Discovery/join UI
7. 5.6 Race detail/leaderboard UI after 5.4 contract is finalized

Rationale:

- Avoid building on unresolved product semantics
- Prevent cached or personalized standings mistakes
- Prevent another epic where UI coverage is repeatedly deferred
- Force docs and route topology to match the live system before extending admin further

## Readiness Verdict

**Conditionally Ready For Re-Planning, Not Ready For Immediate Execution**

The codebase has enough technical capability to support Epic 5. The current plan does not have enough alignment to be safely executable.

If the entrant model, privacy model, admin-surface scope, and leaderboard contract are resolved first, Epic 5 becomes a good next candidate. Without those decisions, the team will likely burn time reworking schema, UI contracts, and cache behavior during implementation.

## Evidence Citations

- Epic 5 planning source: `_bmad-output/planning-artifacts/epics.md`
- Epic 4 retro carry-forward: `_bmad-output/implementation-artifacts/epic-4-retro-2026-03-09.md`
- Current architecture docs: `docs/architecture.md`, `docs/ui-overview.md`, `docs/frontend-guide.md`, `docs/api-reference.md`, `docs/data-models.md`
- Current Worker routing/auth patterns: `src/index.ts`, `src/auth-handlers.ts`
- Existing party-era logic and privacy boundary: `src/party-handlers.ts`, `src/progress-handlers.ts`
- Existing admin surfaces and drift evidence: `src/renderAdminPage.ts`, `src/renderAdminUsersPage.ts`, `src/renderAdminMetricsPage.ts`, `client/src/index.tsx`, `client/src/islands/AdminMetricsIsland.tsx`, `tests/ui/admin.spec.js`, `tests/api/admin-handlers.test.ts`
- Existing service worker cache behavior: `public/sw.js`