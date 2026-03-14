# Sprint Change Proposal

**Date:** 2026-03-14  
**Author:** Bob (SM Agent) with Hayden  
**Trigger:** Cancel Epic 5 (Races) from the active roadmap  
**Mode:** Incremental (collaborative refinement)

---

## 1. Issue Summary

### Problem Statement

Epic 5 (Races) is no longer part of the active product roadmap.

This is no longer a readiness or alignment problem. It is a product-direction decision. The repository still contains active planning artifacts that present races as the next planned feature area, which now conflicts with the intended roadmap.

### How Discovered

During the Correct Course workflow, after reviewing Epic 5 re-planning options, Hayden changed direction and explicitly chose to cancel Epic 5 rather than revise it.

### Evidence

- Epic 5 still appears as an active backlog epic in `_bmad-output/planning-artifacts/epics.md`.
- Epic 5 still appears as `backlog` in `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- The PRD still lists races as a Phase 3 feature in `docs/prd.md`.
- The UX next-steps section still lists races as a future design topic in `docs/ux-design.md`.
- Historical retrospectives and alignment documents reference Epic 5 as the planned next epic.

---

## 2. Impact Analysis

### Epic Impact

| Epic | Impact | Description |
|------|--------|-------------|
| **Epic 5** (Races) | Cancelled | Removed from the active roadmap and sprint/backlog planning sequence. |
| **Epic 6** (Friends & Social Identity) | No scope change | Remains complete, live, accepted, and currently stable. |
| **Epics 1-4** | None | No completed implementation work is affected. |

### Story Impact

- Stories 5.1 through 5.6 are no longer executable backlog items.
- These stories should either be removed from active story listings or clearly marked as cancelled historical records.
- Epic 5 should not remain in `backlog` state after cancellation.

### Artifact Conflicts

| Artifact | Conflict | Resolution |
|----------|----------|------------|
| `docs/prd.md` | Still presents races as active Phase 3 scope | Replace with cancellation note reflecting current roadmap |
| `_bmad-output/planning-artifacts/epics.md` | Still presents Epic 5 as executable | Mark Epic 5 cancelled and remove active story sequencing role |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Still tracks Epic 5 and stories as backlog | Mark Epic 5 and story entries cancelled |
| `docs/ux-design.md` | Still lists races as future UX work | Remove from active next steps |
| Historical Epic 5 analysis docs | Still discuss Epic 5 as future work | Retain as history, but do not treat as active planning inputs |

### Technical Impact

- No code rollback is required.
- No schema, API, UI, or infrastructure changes are required.
- This is a planning and documentation correction only.

---

## 3. Recommended Approach

### Path: Direct Adjustment

Cancel Epic 5 in active planning artifacts and clean up all roadmap-facing documents that still present races as planned work.

This is the correct path because:

1. No Epic 5 implementation exists, so there is nothing to roll back.
2. The product-direction decision is explicit, so the backlog should reflect that decision directly.
3. Historical Epic 5 analysis can remain as repository history without continuing to distort the active roadmap.
4. This keeps planning artifacts honest after Epic 6 rather than implying a non-existent “next epic.”

### Effort Estimate

| Area | Scope |
|------|-------|
| PRD cleanup | Low |
| Epic plan cleanup | Medium |
| Sprint status cleanup | Low |
| UX roadmap cleanup | Low |
| Historical artifact handling | Low |

### Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Future confusion over whether Epic 5 was deferred or cancelled | Medium | Mark Epic 5 explicitly as cancelled in planning artifacts |
| Loss of useful historical planning context | Low | Retain alignment and retrospective documents as historical records |
| Inconsistent roadmap references remain in docs | Medium | Update active planning docs and avoid using historical analysis as current roadmap input |

### Timeline Impact

Epic 6 becomes the last completed epic with no active successor epic currently approved. This creates a roadmap gap intentionally rather than accidentally.

---

## 4. Detailed Change Proposals

All proposals below were presented incrementally and approved by Hayden during this workflow.

### 4.1 PRD Change

**File:** `docs/prd.md`

Replace the current Phase 3 race line:

```md
*   **Races:** Challenge functionality between users/parties (leverages Friends foundation for discovery, privacy, and identity).
```

With:

```md
*   **Races:** Removed from the active roadmap. The app's social layer now includes fellowships, friends, avatars, and friend-based invites, but competitive race functionality is no longer planned as an active Phase 3 deliverable.
```

**Justification:** The PRD must reflect the active product roadmap, not shelved scope.

### 4.2 Epics Plan Change

**File:** `_bmad-output/planning-artifacts/epics.md`

Update Epic 5 from an executable epic to a cancelled historical record:

```md
### Epic 5: Races (Competitive Events) (Issue #154)

**Status:** Cancelled

**Cancellation Note (2026-03-14):**
Race functionality is no longer part of the active product roadmap. Epic 5 is retained here only as a historical planning reference. It must not be used for sprint planning, story creation, or implementation sequencing.

**Reason:**
Product direction has changed. Competitive races are no longer being pursued as an active feature area, even though prerequisite social and identity work was completed in Epic 6.
```

Also:

- Remove or collapse the Story 5.1-5.6 block so it no longer appears as active executable backlog.
- Remove Epic 5 from active implementation-order and “next epic” summaries.
- Revise Epic 6 wording where necessary so it no longer frames itself as preparation for race work.

**Justification:** The epic plan should distinguish cancelled work from active backlog.

### 4.3 Sprint Status Change

**File:** `_bmad-output/implementation-artifacts/sprint-status.yaml`

Replace:

```yaml
  epic-5: backlog
  5-1-race-database-schema: backlog
  5-2-race-management-api-admin: backlog
  5-3-race-join-leave-api: backlog
  5-4-race-leaderboard-api: backlog
  5-5-race-ui-discovery-join: backlog
  5-6-race-ui-leaderboard-progress: backlog
  epic-5-retrospective: optional
```

With:

```yaml
  epic-5: cancelled
  5-1-race-database-schema: cancelled
  5-2-race-management-api-admin: cancelled
  5-3-race-join-leave-api: cancelled
  5-4-race-leaderboard-api: cancelled
  5-5-race-ui-discovery-join: cancelled
  5-6-race-ui-leaderboard-progress: cancelled
  epic-5-retrospective: n/a
```

**Justification:** Sprint tracking must not show cancelled work as backlog.

### 4.4 UX Roadmap Change

**File:** `docs/ux-design.md`

Replace the current next steps:

```md
1. ~~**Map Visualization (Phase 2)**~~ - ✅ Implemented (Epic 3)
2. ~~**Fellowship Features (Phase 3)**~~ - ✅ Implemented (Epic 4)
3. **Friends & Social Identity (Phase 3)** - Avatar system, friend discovery, social map panel
4. **Races (Phase 3)** - Competitive gameplay UX patterns
5. **Onboarding Flow** - New user first-run experience
6. **Dark Mode Refinement** - Formalized theme system with potential light mode
```

With:

```md
1. ~~**Map Visualization (Phase 2)**~~ - ✅ Implemented
2. ~~**Fellowship Features (Phase 3)**~~ - ✅ Implemented
3. ~~**Friends & Social Identity (Phase 3)**~~ - ✅ Implemented
4. **Onboarding Flow** - New user first-run experience
5. **Dark Mode Refinement** - Formalized theme system with potential light mode
```

Optional note:

```md
> Race UX exploration has been removed from the active roadmap along with Epic 5.
```

**Justification:** UX next steps should reflect active work, not cancelled planning.

### 4.5 Historical Artifact Handling

**Files:**

- `_bmad-output/implementation-artifacts/epic-5-architecture-alignment-2026-03-09.md`
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-03-09.md`
- `_bmad-output/implementation-artifacts/epic-4-retro-2026-03-09.md`
- `_bmad-output/implementation-artifacts/epic-6-retro-2026-03-14.md`

Recommended treatment:

- Retain these files as historical records.
- Do not use their “next epic” language as active roadmap guidance.
- Optionally add a short note later if desired indicating Epic 5 was subsequently cancelled.

**Justification:** Historical reasoning is useful, but it should not overwrite current roadmap truth.

---

## 5. Implementation Handoff

### Change Scope: Moderate

This is a moderate planning correction. It does not affect code, but it does require coordinated updates across the active roadmap, sprint tracking, and product documentation.

### Handoff Recipients

| Role | Responsibility |
|------|---------------|
| **Scrum Master (Bob)** | Update roadmap and sprint-tracking artifacts to reflect cancellation |
| **Product Manager / Product Owner** | Ensure PRD and planning language reflect current product direction |
| **Technical Writer / Documentation Owner** | Clean up UX and summary docs that still imply races are planned |

### Success Criteria

1. Epic 5 no longer appears as active backlog in planning artifacts.
2. Sprint tracking no longer marks Epic 5 stories as backlog.
3. PRD no longer presents races as active planned scope.
4. UX next steps no longer include races.
5. Historical Epic 5 documents remain available without being mistaken for active roadmap guidance.
6. The repo no longer implies there is an approved next epic after Epic 6 unless a new one is explicitly created.

### Next Steps

1. Update the active planning artifacts listed above.
2. Verify no remaining active-roadmap docs still point to Epic 5 as upcoming work.
3. Leave Epic 5 analysis and retrospective references in place as history unless a later archival pass is requested.

---

*Sprint Change Proposal generated by Correct Course workflow on 2026-03-14.*