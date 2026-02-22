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

**Next Step:** All Epic 2 stories are now `done` (or `cancelled`) and `epic-2-retrospective` is `done`. `epic-2` has been updated to `done` in `sprint-status.yaml`.

---

## Section 6: Sprint Planning Update (SP) — Epic 3 Readiness Gates

The following gates are now mandatory sequencing items for Epic 3 kickoff.

### Gate 1 — CI Reliability (Blocking)

**Intent:** Prevent flaky test infrastructure from invalidating sprint outcomes.

**Entry Criteria:**
- Critical Playwright flows are identified.

**Exit Criteria:**
- Deterministic controls are defined and applied (seeded data, stable viewport, clock/animation controls where relevant).
- CI stability is verified for critical Playwright checks.
- Any quarantined test has owner + rationale + explicit exit criteria.

### Gate 2 — Requirement-Change Control (Blocking)

**Intent:** Eliminate requirement drift between product decisions and delivery artifacts.

**Exit Criteria:**
- Requirement delta is documented in the active story artifact.
- Revised acceptance criteria are acknowledged by Product + Dev before implementation resumes.
- Story test plan and requirement traceability are updated.

### Gate 2b — Future Story Propagation (Blocking, Non-Negotiable)

**Intent:** Ensure requirement changes are carried forward to downstream planning.

**Exit Criteria:**
- All impacted future stories are reviewed and updated (ACs, dependencies, sequencing, risks).
- Impacted stories are tagged with `change-impact` notes.
- **No impacted story may begin while unresolved `change-impact` flags remain.**

### Gate 3 — Definition-of-Done Traceability (Blocking)

**Intent:** Ensure no accepted requirement is left unverified.

**Exit Criteria:**
- Story cannot be marked `done` unless each accepted requirement has either:
  - automated test evidence, or
  - explicit manual verification note.

### Epic 3 Sequencing Order (Updated)

1. Complete Gate 1 (CI Reliability)
2. Enforce Gate 2 + Gate 2b (Requirement-Change + Propagation)
3. Enforce Gate 3 (DoD Traceability)
4. Start Epic 3 story execution

### Ownership

- **Gate 1:** Dana (QA) + Charlie (Senior Dev)
- **Gate 2 / 2b:** Alice (PO) + Charlie (Senior Dev) + Bob (Scrum Master)
- **Gate 3:** Charlie (Senior Dev) + Dana (QA)

### Governance Note

This SP amendment is derived from the Epic 2 retrospective and is now part of the sprint planning baseline for Epic 3.
