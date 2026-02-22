# Sprint Change Proposal — 2026-02-22

## Section 1: Issue Summary

**Problem Statement:** Story 2-9 (Map Visual Testing) is being cancelled by deliberate decision before implementation began.

**Context:** Story 2-9 was the final remaining planned story in Epic 2 (Interactive Journey Map). It was in `ready-for-dev` status — no code had been written. Cancellation was initiated by the product owner (Hayden) during active sprint execution.

**Evidence:** Zero implementation exists for this story. Existing visual regression infrastructure (`tests/ui/map-visual.spec.js`) already provides baseline map coverage. The story represented additional/extended test coverage, not foundational testing.

---

## Section 2: Impact Analysis

**Epic Impact:**
- Epic 2 remains on track. With 2-9 cancelled, Epic 2 can close to `done` as soon as Story 2-4 (currently `review`) is completed.

**Story Impact:**
- 2-9: Cancelled. No rollback required — zero code written.
- 2-4: Unaffected — continues through review independently.
- All other Epic 2 stories: `done` — unaffected.

**Artifact Conflicts:**
- PRD: None — visual testing was a developer-experience concern, not a user-facing requirement.
- Architecture: None.
- UI/UX: None.

**Technical Impact:** None. No code exists to remove. Existing Playwright visual tests remain in place.

---

## Section 3: Recommended Approach

**Path:** Direct Adjustment — mark story cancelled, allow Epic 2 to close naturally when 2-4 is done.

**Rationale:** Story had not started. Cancellation cost is zero. Existing coverage from `map-visual.spec.js` is sufficient for the current MVP. No ripple effects on any other story, epic, or artifact.

**Effort:** None. **Risk:** None. **Timeline impact:** Neutral (removes outstanding work, potentially accelerates Epic 2 close).

---

## Section 4: Detailed Change Proposals

**Change 1: sprint-status.yaml**

```
OLD: 2-9-map-visual-testing: ready-for-dev
NEW: 2-9-map-visual-testing: cancelled
```

**Change 2: 2-9-map-visual-testing.md**

```
OLD: Status: ready-for-dev
NEW: Status: cancelled
```

---

## Section 5: Implementation Handoff

**Scope Classification:** Minor — directly applied.

**Changes Applied:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status updated to `cancelled`
- `_bmad-output/implementation-artifacts/2-9-map-visual-testing.md` — status header updated to `cancelled`

**Next Step:** Once Story 2-4 transitions from `review` to `done`, update `sprint-status.yaml` to mark `epic-2: done`.
