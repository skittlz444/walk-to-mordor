# Test Design: System-Level Strategy & Architecture

**Date:** 2026-01-16
**Author:** Hayden (Tea)
**Status:** Draft - Implementation Readiness Review

---

## Executive Summary

**Scope:** System-level testability review and strategic test planning for "Walk to Mordor". This document defines the quality gates, risk mitigation strategies, and testing architecture required to proceed to Implementation.

**Risk Summary:**

- **Total risks identified:** 6
- **High-priority risks (≥6):** 2 (Security, Technical Complexity)
- **Critical categories:** Map Visualization, Data Isolation

**Coverage Summary:**

- **Unit Testing Strategy:** Strict TDD for core calculation logic (Jest).
- **Integration Strategy:** Miniflare-based API testing for D1 interactions.
- **E2E Strategy:** Playwright for critical user journeys (Samwise, Bilbo).
- **Visual Strategy:** Snapshot testing for Konva.js map components.
- **Total Estimated Effort:** Integrated into feature development (Story points).

---

## Risk Assessment

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| R-001 | SEC | **IDOR Vulnerability**: Users accessing/modifying other users' walk logs or profile data. | 2 | 3 | 6 | Strict `auth-session` middleware on ALL API routes. Integration tests for negative auth cases (User A trying to edit User B). | Architect | Phase 1 |
| R-002 | TECH | **Map Complexity**: Konva.js + Preact integration causing performance issues or rendering bugs on mobile. | 2 | 3 | 6 | Early "Spike" implementation. Visual regression testing (Snapshots) for map states. Component isolation tests. | Dev | Phase 2 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R-003 | PERF | **Calculation Latency**: Recalculating total distance + checking 171 milestones on every log update exceeds 500ms. | 2 | 2 | 4 | Optimize SQL queries. Pre-calculate "next milestone" distance. Performance tests on `POST /log`. | Dev |
| R-004 | DATA | **Data Isolation**: Future Fellowship features compromising strict private-by-default promise. | 1 | 3 | 3 | Design immutable isolation rules in D1 schema. Regression test suite for privacy boundaries. | Architect |
| R-005 | OPS | **Asset Limits**: High-res milestone imagery exceeding Cloudflare Worker 25MB bundle limit. | 2 | 2 | 4 | Automated asset optimization (WebP). Store assets in R2/Assets Binding, not bundle. Build-time size checks. | Ops |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| R-006 | BUS | **Lore Inaccuracy**: Incorrect milestone descriptions or distances. | 1 | 2 | 2 | Community review. Admin tool for hotfixes (FR_ADM_01). |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Test Coverage Plan & Architecture

### Test Levels & Frameworks

| Level | Framework | Scope | Focus Areas | Target Coverage |
|-------|-----------|-------|-------------|-----------------|
| **Unit** | Jest | `src/*.ts` | Business Logic, Validators, Distance Calculation, Unlock Engine. pure functions. | >90% |
| **Integration** | Jest + Miniflare | `tests/api/` | API Endpoints, D1 Interactions, Auth Middleware, Error Handling. | 100% of Routes |
| **Component** | Jest + TLS | `client/src/` | Preact Components, State (Signals), interactive elements. | Key Interaction |
| **E2E** | Playwright | `tests/ui/` | Critical User Journeys (Onboarding, Logging, Map Interaction), Visual Regression. | Core Flows |

### P0 (Critical) - Acceptance Gates

**Criteria**: Must pass to deploy. Verified by CI.

| Requirement | Test Level | Risk Link | Strategy |
|-------------|------------|-----------|----------|
| **FR_AUTH_05** (Data Isolation) | Integration | R-001 | Create User A & B. User A attempts to read/write User B's logs. Assert 403 Forbidden. |
| **FR_LOG_05** (Recalculation) | Unit | R-003 | Test `calculateProgress(logs)` with edge cases (0km, negative, massive values). Verify total matches. |
| **FR_LORE_02** (Unlock Logic) | Unit | R-006 | Test `checkUnlocks(totalDistance)` against mock milestone list. Verify correct subset returned. |
| **FR_AUTH_01** (Registration) | E2E | - | Full "Bilbo" flow: Landing -> Sign Up -> Email Confirm Trigger -> Dashboard. |

### P1 (High) - Feature Validation

**Criteria**: Run on PRs.

| Requirement | Test Level | Risk Link | Strategy |
|-------------|------------|-----------|----------|
| **FR_MAP_01** (Map Render) | Visual (E2E) | R-002 | Component test for `MapCanvas`. Snapshot matches baseline image of Shire region. |
| **FR_LOG_04** (Edit Logs) | Integration | R-001 | Verify editing a past log triggers recalculation and updates milestones. |
| **NFR_PERF_01** (TTI) | E2E (Perf) | R-003 | Playwright trace analysis. Assert `AddWalkModal` appears <500ms after click. |

### P2 (Medium) - Reliability & Edge Cases

**Criteria**: Nightly / Regression.

| Requirement | Test Level | Strategy |
|-------------|------------|----------|
| **FR_ADM_02** (Intermediary Goals) | Integration | Verify inserting goals via SQL migration doesn't corrupt existing user progress. |
| **NFR_ACC_01** (Contrast) | E2E (A11y) | Automated `axe-core` scan on all primary views (Dashboard, Calendar, Profile). |

---

## Tooling & Infrastructure Setup

1.  **Framework config**: `jest.config.json` and `playwright.config.js` are already established.
    *   **Action**: Ensure `playwright.config.js` is tuned for "Network-First" interception patterns to avoid flakiness.
2.  **CI Pipeline**:
    *   **Unit/Integration**: Run on every commit.
    *   **E2E**: Run on PR to main.
3.  **Visual Testing**:
    *   Use Playwright built-in snapshots for Map canvas verification.
    *   *Note*: Store snapshots in `tests/ui/snapshots/`.

## Definition of Done (Testing)

- [ ] All new logic covered by Unit Tests (>90%).
- [ ] All new API endpoints covered by Integration Tests (Positive & Negative).
- [ ] Critical Happy Path verified by E2E.
- [ ] No new P0/P1 risks introduced without mitigation.
- [ ] Accessibility scan passes (WCAG AA).
