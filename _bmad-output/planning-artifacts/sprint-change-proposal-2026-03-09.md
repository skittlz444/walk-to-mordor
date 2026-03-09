# Sprint Change Proposal

**Date:** 2026-03-09
**Author:** Bob (SM Agent) with Hayden
**Trigger:** Epic 5 Architecture Alignment Review — No-Go As Written
**Mode:** Incremental (collaborative refinement)

---

## 1. Issue Summary

### Problem Statement

The Epic 5 (Races & Competitive Play) architecture alignment review identified a **No-Go As Written** verdict. The race design depends on several relational and identity primitives that do not yet exist in the system:

- **No user-to-user relationships** — Races need entrants, but there's no friendship or social graph to build on.
- **No identity/display contract** — Races need visible user identities (avatars, usernames on leaderboards) but no display system exists.
- **No privacy/discovery model** — Race participation implies visibility, but no rules govern who can see whom.
- **Underspecified entrant model** — Race entry, withdrawal, and position tracking have no relational foundation.

### How Discovered

During pre-implementation alignment review of Epic 5 against current architecture, data models, and PRD. The review document is at `_bmad-output/implementation-artifacts/epic-5-architecture-alignment-2026-03-09.md`.

### Evidence

The alignment review identified 4 critical blockers and rated Epic 5's readiness as "No-Go As Written" — meaning implementation would require designing relational primitives inline with race logic, leading to tightly coupled and fragile code.

---

## 2. Impact Analysis

### Epic Impact

| Epic | Impact | Description |
|------|--------|-------------|
| **Epic 5** (Races) | 🔶 Blocked | Cannot proceed as written. Depends on friendship model, identity system, and privacy rules that don't exist yet. |
| **Epic 6** (New) | 🟢 Added | "Friends & Social Identity" epic created to provide the relational foundation. |
| **Epics 1-4** | ⚪ None | No changes to completed or in-progress epics. |

### Story Impact

- **6 new stories** added (Stories 6.1–6.6) covering schema, friend API, fellowship invites, friends UI, avatar UI, and map social panel.
- **Epic 5 stories** unchanged but annotated with dependency notes on Epic 6.
- **Total story count:** 39 → 45.

### Artifact Conflicts Resolved

| Artifact | Conflict | Resolution |
|----------|----------|------------|
| PRD | No friend/social requirements existed | Added FR_FRIEND_01–10, FR_PARTY_14–17 |
| Epics | No Epic 6, no friend stories | Added Epic 6 with 6 stories, updated FR coverage map |
| Architecture | No friend routes, no social tables | Added 14 API endpoints, 3 page routes, 2 tables |
| Data Models | No friendships/invites schema | Added `friendships`, `fellowship_invites` tables; `avatar_id`/`friend_code` on users |
| UI Overview | No friends pages/islands | Added 4 islands, 3 renderers, navigation badges, Social panel |
| Frontend Guide | No friends component docs | Added island docs, Avatar component, directory map update |
| API Reference | No friend/invite endpoints | Added 14 endpoint contracts with request/response shapes |
| UX Design | No friends screen designs | Added 5 screen proposals (Friends List, Profile, Add Friend, Avatar, Social Panel) |

### Technical Impact

- **Database:** 2 new tables + 2 new columns on `users`. Migration required before any friend feature work.
- **Worker routes:** 14 new API routes + 3 SSR page routes. All follow established patterns.
- **Client:** 4 new Preact islands, 1 new reusable component (`Avatar`), 1 new signal store (`friendsStore`).
- **Map:** Existing `FellowshipSelectorIsland` replaced by unified `SocialPanelIsland`.
- **Assets:** ~20-30 predefined avatar images in `public/img/avatars/` (WebP, static).
- **No infrastructure changes.** No R2, no external services, no new Workers.

---

## 3. Recommended Approach

### Path: Direct Adjustment

**Add Epic 6 (Friends & Social Identity) before Epic 5 (Races).**

This is the cleanest path because:

1. **Decouples concerns** — Friend model, identity, and privacy are general-purpose primitives. Building them separately means races can consume them cleanly rather than reinventing them.
2. **Minimal disruption** — No existing epics are modified or reordered. Epic 6 slots into the implementation order between Epic 4 (completed) and Epic 5 (not started).
3. **Reuse** — Fellowship invites via friends, avatar on map, social panel — all immediately useful independent of races.
4. **Race design simplifies** — With friendships, avatars, and a privacy model in place, race stories can focus purely on competitive mechanics.

### Effort Estimate

| Story | Scope |
|-------|-------|
| 6.1 Schema & Avatars | P0 blocker — migration + asset pipeline |
| 6.2 Friend Request API | P1 — CRUD + search + friend code |
| 6.3 Fellowship Invite API | P1 — invite/accept/reject + badge |
| 6.4 Friends UI | P1 — 3 pages + nav integration |
| 6.5 Avatar UI | P1 — gallery picker + Avatar component |
| 6.6 Map Social Panel | P2 — unified panel + friend positions |

### Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Avatar asset creation delays | Low | Use placeholder silhouettes; assets are independent of code |
| Friend code collision | Very Low | 8-char alphanumeric = 2.8T combinations; add uniqueness retry |
| Social panel complexity on mobile | Medium | Collapsible design, progressive disclosure |
| Scope creep into messaging/chat | Low | Explicitly out of scope in PRD |

### Timeline Impact

Epic 5 start is deferred until Epic 6 completes. No impact on Epics 1-4. The net effect is a stronger foundation that reduces Epic 5 implementation risk.

---

## 4. Detailed Change Proposals

All proposals were presented incrementally and approved by Hayden during this workflow.

### 4.1 PRD Changes

**File:** `docs/prd.md`

- Added **§7 Friends & Social Identity** with requirements FR_FRIEND_01 through FR_FRIEND_10:
  - FR_FRIEND_01: Send/accept/reject friend requests (mutual model)
  - FR_FRIEND_02: Username search (3+ char prefix)
  - FR_FRIEND_03: Shareable friend code / link
  - FR_FRIEND_04: Friends list with avatar + "Last Progressed"
  - FR_FRIEND_05: Friend profile page (avatar, username, shared fellowships)
  - FR_FRIEND_06: Remove friend (mutual unfriend)
  - FR_FRIEND_07: Predefined LOTR-themed avatar gallery
  - FR_FRIEND_08: Avatar display across UI surfaces
  - FR_FRIEND_09: Friends visible on map (toggle, avatar markers)
  - FR_FRIEND_10: Pending request count badge on nav
- Added fellowship-friends integration requirements FR_PARTY_14–17:
  - FR_PARTY_14: Invite friend to fellowship
  - FR_PARTY_15: Fellowship invite badge on nav
  - FR_PARTY_16: Accept/reject fellowship invites from list
  - FR_PARTY_17: Add-friend shortcut from party member list
- Updated Phase 3 scope paragraph

### 4.2 Epics Changes

**File:** `_bmad-output/planning-artifacts/epics.md`

- Added **Epic 6: Friends & Social Identity** with 6 stories (6.1–6.6)
- Added Epic 5 alignment note referencing Epic 6 dependencies
- Updated FR Coverage Map with all new FR_FRIEND and FR_PARTY entries
- Updated Summary table (45 total stories)
- Updated Recommended Implementation Order (Epic 6 between 4 and 5)

### 4.3 Architecture Changes

**File:** `docs/architecture.md`

- Added 10 Friends API routes and 4 Fellowship Invite routes
- Added 3 Friends page routes (`/friends`, `/friends/:id`, `/friends/add/:friendCode`)
- Added `friendships` and `fellowship_invites` to D1 tables list
- Added Map Social panel note

### 4.4 Data Model Changes

**File:** `docs/data-models.md`

- Added `avatar_id TEXT` and `friend_code TEXT UNIQUE` columns to `users`
- Added full `friendships` table documentation (schema, constraints, indexes, query patterns)
- Added full `fellowship_invites` table documentation (schema, constraints, indexes, invariants)
- Updated ER diagram with new relationships

### 4.5 UI Overview + Frontend Guide Changes

**Files:** `docs/ui-overview.md`, `docs/frontend-guide.md`

- Added Friends pages (3 renderers → 3 auto-hydrated islands)
- Added `SocialPanelIsland` to programmatic islands
- Added navigation badge descriptions
- Added island documentation for all 4 new islands
- Added `Avatar` reusable component documentation
- Updated directory map

### 4.6 API Reference Changes

**File:** `docs/api-reference.md`

- Added **Friends Endpoints** section (10 endpoints) with full request/response contracts
- Added 4 Fellowship Invite endpoints (`POST invite-friend`, `GET fellowship-invites`, `POST accept`, `POST reject`)
- Each endpoint documents: auth requirements, body/query params, response shapes, error codes, validation rules

### 4.7 UX Design Changes

**File:** `docs/ux-design.md`

- Added 5 new screen proposals: Friends List, Friend Profile, Add Friend (code landing), Avatar Selection, Map Social Panel
- Each screen includes observations, strengths, and improvement opportunities
- Updated Next Steps to reflect Phases 2-3 completion status and add Friends/Races items

---

## 5. Implementation Handoff

### Change Scope: Moderate

This change adds a full new epic (6 stories, 8 artifacts updated) that must be completed before Epic 5 can begin. It requires backlog reorganization and story preparation.

### Handoff Recipients

| Role | Responsibility |
|------|---------------|
| **Scrum Master (Bob)** | Story preparation for Epic 6, sprint planning |
| **Developer (Amelia)** | Story implementation starting with 6.1 (schema blocker) |
| **QA (Quinn)** | Test plan for friend/invite flows, avatar rendering |

### Success Criteria

1. All 6 stories (6.1–6.6) implemented and passing tests
2. Friend request/accept/reject flow works end-to-end
3. Fellowship invite via friends flow works end-to-end
4. Avatar selection persists and renders across all surfaces (friends list, profile, map, party)
5. Map Social Panel replaces fellowship-only selector with unified controls
6. No regressions in existing fellowship, progress, or auth functionality
7. Epic 5 alignment review re-run passes after Epic 6 completion

### Next Steps

1. **SM:** Prepare Story 6.1 for sprint (acceptance criteria, technical notes)
2. **Dev:** Begin with migration + avatar asset pipeline (6.1 is P0 blocker)
3. **QA:** Draft test plan covering friend and invite flows
4. **Re-evaluate Epic 5** after Epic 6 completion — re-run architecture alignment

---

*Sprint Change Proposal generated by Correct Course workflow on 2026-03-09.*
