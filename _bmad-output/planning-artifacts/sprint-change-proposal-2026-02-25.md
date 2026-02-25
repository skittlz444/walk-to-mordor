# Sprint Change Proposal — 2026-02-25

## Section 1: Issue Summary

**Problem Statement:** Epic 3 (Fellowship Features) requirements have been significantly expanded based on product owner feedback to support multi-party membership, party-level settings, leader kick controls, cross-page party selectors, and party milestone notifications.

**Context:** All Epic 3 stories (3.1–3.3 in `ready-for-dev`, 3.4–3.9 in `backlog`) are impacted by this requirement expansion. No implementation has begun. The changes are being applied before any code is written.

**Evidence:** Requirements expansion originated from product owner (Hayden) input on 2026-02-25.

---

## Section 2: Impact Analysis

**Epic Impact:**
- Epic 3 scope and story descriptions are materially changed.
- Three new functional requirements added (FR_PARTY_07, FR_PARTY_08, FR_PARTY_09).
- Existing FR_PARTY_01 through FR_PARTY_06 are refined (not removed).

**Story Impact:**

| Story | Status | Impact Level | Summary of Changes |
|-------|--------|-------------|---------------------|
| 3.1 | ready-for-dev | **High** | New columns: `distance_mode`, `leave_distance_behavior` on `parties`; `last_viewed_distance`, `status='kicked'` on `party_members`; multi-party index |
| 3.2 | ready-for-dev | **High** | Request body expanded with party settings; multi-party creation explicit |
| 3.3 | ready-for-dev | **Medium** | Preview includes party settings; multi-party join explicit; re-join logic added |
| 3.4 | backlog | **High** | Distance mode from party setting (not query param); leave behavior setting governs departed members; milestone tracking via `last_viewed_distance` |
| 3.5 | backlog | **High** | Renamed to "Leave & Kick"; new kick endpoint with distance override; leave behavior governed by party setting |
| 3.6 | backlog | **High** | Renamed to "Journey & Map Party Selector"; completely restructured for multi-party selector on Journey/Map pages with per-member segments and milestone modal on party swap |
| 3.7 | backlog | **High** | Restructured to start with party list/selector; includes party settings UI, kick member UI, multi-party management |
| 3.8 | backlog | **Low** | Minor — feed scoped to currently selected party |
| 3.9 | backlog | **Medium** | Added party view switch milestone modal (FR_PARTY_09 integration) |
| 3.10 | deprecated | **Low** | Updated distribution list for new FRs |

**Artifact Conflicts:**
- PRD (`docs/prd.md`): Updated — Phase 3 description expanded, FR_PARTY section added with 9 FRs, Aragorn user journey updated.
- Architecture (`docs/architecture.md`): Updated — ADR-004 schema expanded with new columns and rationale.
- Epics (`_bmad-output/planning-artifacts/epics.md`): Updated — all Epic 3 stories revised, FR table expanded.
- Implementation Artifacts: Stories 3.1, 3.2, 3.3 updated with `change-impact` sections.

**Technical Impact:** No existing code needs to change (Epic 3 has no implementation yet). Schema design is materially different from original plan.

---

## Section 3: Recommended Approach

**Path:** Direct Adjustment — update all planning and implementation artifacts before any code is written.

**Rationale:** No code exists for any Epic 3 story. All changes can be applied purely to documentation and planning artifacts at zero rollback cost. This is the ideal time to expand requirements.

**Effort:** Documentation-only (this proposal). **Risk:** Low — no code to reconcile. **Timeline impact:** Stories 3.5–3.7 are more complex than originally scoped, which may extend Epic 3 timeline.

---

## Section 4: Detailed Change Proposals

### New Functional Requirements (PRD)

| ID | Requirement |
|----|-------------|
| FR_PARTY_07 | Party leaders can kick members with optional distance removal override |
| FR_PARTY_08 | Party selector on Journey and Map pages (hidden if no parties) |
| FR_PARTY_09 | Party milestone modal triggered on view switch when new milestones passed |

### Updated Functional Requirements (PRD)

| ID | Change |
|----|--------|
| FR_PARTY_01 | Added: multi-party membership supported |
| FR_PARTY_03 | Clarified: join via invite code (not accept/decline) |
| FR_PARTY_04 | Added: distance mode as party setting (not user toggle) |
| FR_PARTY_05 | Added: per-member segments on Map view |
| FR_PARTY_06 | Added: leave-distance behavior as party setting |

### Schema Changes (ADR-004 / Story 3.1)

**`parties` table — new columns:**
- `distance_mode` (TEXT, default 'incremental') — cumulative or incremental calculation
- `leave_distance_behavior` (TEXT, default 'keep') — keep or remove departed member distance

**`party_members` table — new/modified columns:**
- `last_viewed_distance` (DECIMAL, default 0) — tracks party distance at user's last view for milestone notifications
- `status` — now supports 'kicked' in addition to 'active' and 'left'

**New indexes:**
- `party_members(user_id)` — for efficient multi-party membership queries

### Story Title Changes

| Story | Old Title | New Title |
|-------|-----------|-----------|
| 3.5 | Leave Fellowship API | Leave & Kick Fellowship API |
| 3.6 | Fellowship UI - Dashboard Integration | Fellowship UI - Journey & Map Party Selector |
| 3.7 | Fellowship UI - Management Page | Fellowship UI - Fellowships Management Page |

---

## Section 5: Implementation Handoff

**Scope Classification:** Major — all Epic 3 stories impacted.

**Changes Applied:**

| File | Change Description |
|------|-------------------|
| `docs/prd.md` | Phase 3 description expanded; FR_PARTY section (6→9 FRs) added; Aragorn journey updated |
| `docs/architecture.md` | ADR-004 schema expanded with party settings, `last_viewed_distance`, 'kicked' status, multi-party rationale |
| `_bmad-output/planning-artifacts/epics.md` | Epic 3 overview, FR table, and all stories (3.1–3.10) updated |
| `_bmad-output/implementation-artifacts/3-1-fellowship-database-schema.md` | Schema story updated with new columns, tasks, dev notes, and `change-impact` section |
| `_bmad-output/implementation-artifacts/3-2-create-fellowship-api.md` | Create API story updated with party settings, multi-party, and `change-impact` section |
| `_bmad-output/implementation-artifacts/3-3-invite-join-fellowship-api.md` | Join API story updated with preview settings, multi-party, re-join logic, and `change-impact` section |

**Gate 2b Compliance:** All `ready-for-dev` stories (3.1, 3.2, 3.3) have been updated with `change-impact` sections. All `backlog` stories (3.4–3.9) have been updated in the epics file with `change-impact` notes. No story may begin implementation until these change-impact flags are reviewed and acknowledged.

---

## Section 6: Suggested Additional Changes & Ideas

The following are suggestions for the product owner to consider based on the requirement changes:

### Suggested Changes

1. **`distance_at_departure` column on `party_members`:** When a member leaves/is kicked and `leave_distance_behavior` is 'keep', their contribution should be frozen. Consider adding a `distance_at_departure` column to store the member's total distance at departure time, making it efficient to include frozen contributions in progress calculations without re-querying the progress table.

2. **Party settings update API:** The current stories allow setting `distance_mode` and `leave_distance_behavior` at creation time (Story 3.2) and via the management UI (Story 3.7), but there's no explicit API story for updating party settings. Consider adding a `PUT /api/party/:id/settings` endpoint to Story 3.5 or creating a new story.

3. **`GET /api/user/parties` endpoint:** Story 3.6 references this endpoint for the party selector, but it's not explicitly defined in any API story. Consider adding it to Story 3.3 (since it's related to party membership queries) or as a new lightweight story.

4. **Leadership transfer on kick-self prevention:** Story 3.5 prevents leaders from kicking themselves but doesn't cover the scenario where a leader wants to step down without leaving. Consider a `POST /api/party/:id/transfer-leadership` endpoint.

5. **Party dissolution:** What happens when all members leave a party? Consider whether empty parties should be auto-dissolved or remain for potential future re-joins.

### Ideas for Future Consideration

1. **Party activity indicator on selector:** When the user views the party selector, show a "new activity" badge on parties that have had activity since the user's last view — beyond just milestones, this could include new members joining or distance updates.

2. **Member contribution visualization on Map:** Consider using different colors or line styles for each member's contributed segments on the Map view. This could use the existing Konva.js path rendering from Epic 2 with slight modifications.

3. **Party leaderboard within a party:** Show a ranking of members by contribution within the party detail view. This complements the per-member breakdown already specified.

4. **Invite link expiry:** Consider whether invite codes should have an optional expiry time, configurable by the leader, for security purposes.

5. **Party max member limit:** Consider whether parties should have an optional max member count, configurable by the leader.

6. **Notification preferences per party:** Since users can be in multiple parties, consider per-party notification preferences to avoid notification fatigue.

---

## Section 7: Product Owner Decisions on Suggestions (2026-02-25)

The following decisions were made by the product owner (Hayden) in response to Section 6 suggestions.

### Suggested Changes — Decisions

| # | Suggestion | Decision | Action |
|---|-----------|----------|--------|
| 1 | `distance_at_departure` column | **REJECTED** | Not needed — contributed distances are calculable from `distance_at_join` combined with a `departed_at` timestamp via the `progress` table, and the `party_progress_log` serves as an audit trail. Re-join handling clarified: creates a new `party_members` record (preserving old records for history). |
| 2 | Party settings update API | **ACCEPTED** | Add `PUT /api/party/:id/settings` endpoint to Story 3.5. Leaders can update `distance_mode` and `leave_distance_behavior` after creation. |
| 3 | `GET /api/user/parties` endpoint | **ACCEPTED** | Add to Story 3.3 as a new endpoint. Returns all parties the user is an active member of. |
| 4 | Leadership transfer endpoint | **ACCEPTED** | Add `POST /api/party/:id/transfer-leadership` endpoint to Story 3.5. Leaders can step down without leaving. |
| 5 | Party dissolution | **ACCEPTED** | Auto-dissolve (soft-delete) empty parties when all members have left. Added to Story 3.5 as part of leave/kick handling. |

### Ideas — Decisions

| # | Idea | Decision | Action |
|---|------|----------|--------|
| 1 | Party activity indicator on selector | Deferred | Not in current scope |
| 2 | Member color coding on Map | **ACCEPTED** | Add per-member color-coded segments to Story 3.6 (Map Party Selector). Use a preset color palette assigned by member join order. |
| 3 | Party leaderboard within a party | Deferred | Not in current scope |
| 4 | Invite link expiry | **REJECTED** | Not needed |
| 5 | Party max member limit | **REJECTED** | Not needed |
| 6 | Notification preferences per party | **REJECTED** | Not needed |

### Follow-Up Items Identified

The following new items were identified during the review and should be tracked for future implementation:

1. **User custom map icon (FR_PARTY_13):** Users can set a custom icon/avatar to distinguish themselves on the Map view. Requires a profile icon field on the `users` table and an upload/selection UI in the profile modal.

2. **Fellowship profile icon (FR_PARTY_14):** Party leaders can set a profile icon for their Fellowship. Requires an icon field on the `parties` table and management UI on the Fellowships page.

3. **Navigation link to Fellowships:** The DrawerIsland navigation needs a link to the `/party` (Fellowships) page. Covered in Story 3.7.

4. **Walk logging → party_progress_log integration:** When a user logs a walk, entries should be automatically inserted into `party_progress_log` for each of their active parties. This enables both the activity feed (Story 3.8) and provides the audit trail for departed member contributions. Should be specified in Story 3.4 or as a cross-cutting concern.

### Schema Impact from Decisions

**`party_members` table — new column:**
- `departed_at` (DATETIME, default NULL) — set when member status changes to 'left' or 'kicked'. Used with `distance_at_join` and the `progress` table to calculate departed member contributions without needing a `distance_at_departure` column.

**Re-join mechanism:**
- When a user re-joins a party they previously left/were kicked from, a **new** `party_members` record is created with fresh `distance_at_join` and `departed_at = NULL`. The old record is preserved with its original `distance_at_join`, `departed_at`, and status for contribution history.

---

## Section 8: Fellowship UI Restructuring (2026-02-25)

**Problem:** Story 3.7 originally specified a single `/party` page combining fellowship listing, detail viewing, and management functionality. Product owner feedback requires a clear page separation to improve UX flow and navigation.

**Decision:** Restructure the Fellowship UI into a 3-page flow:

| Page | Route | Purpose | Access |
|------|-------|---------|--------|
| Fellowships List | `/party` | Select fellowship, create new, join via code | All authenticated users |
| Fellowship Detail | `/party/:id` | View members, contributions, total progress, last milestone, activity feed, leave button, invite code | Party members |
| Fellowship Management | `/party/:id/manage` | Update settings, kick members, transfer leadership, regenerate invite | Party leader only |

**Navigation Flow:**
```
DrawerIsland → "Fellowships" link → /party (list)
  → Click party → /party/:id (detail)
    → "Manage Fellowship" button (leader only) → /party/:id/manage (management)
```

**Story Impact:**

| Story | Impact |
|-------|--------|
| 3.7 | **High** — Restructured from single-page to 3-page flow. Story renamed to "Fellowship UI - Fellowships Pages". Detail page shows total progress, last milestone, member contributions, activity feed inline. Management page is leader-only. |
| 3.8 | **Medium** — Activity feed now explicitly lives on the Fellowship detail page (`/party/:id`) instead of a generic "currently selected party" context. |
| 3.6 | **None** — Party selector on Journey/Map pages remains unchanged. |
| 3.9 | **None** — Milestone notifications remain on Journey/Map party selector switch. |

**Additional UI observations from this PR:**
- DrawerIsland navigation link to `/party` was already specified in Story 3.7 but is now confirmed as part of the flow.
- The Fellowship detail page (`/party/:id`) consolidates what was previously scattered: member list, contributions, party progress, last milestone, and activity feed.
- No new API endpoints are required beyond those already specified in Stories 3.3–3.5. The UI pages consume the same APIs.
