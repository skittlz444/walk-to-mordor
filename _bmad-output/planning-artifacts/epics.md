---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - docs/prd.md
  - docs/architecture.md
  - docs/ux-design.md
---

# walk-to-mordor - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for walk-to-mordor, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

| ID | Requirement |
|----|-------------|
| **FR_AUTH_01** | Users can create a new account using an email and password |
| **FR_AUTH_02** | Users can log in to their account to access their private data |
| **FR_AUTH_03** | Users must confirm their email address to activate their account (replacing manual approvals) |
| **FR_AUTH_04** | Users can request a password reset functionality via email if they forget their credentials |
| **FR_AUTH_05** | System must enforce strict data isolation so users can only view and edit their own logs |
| **FR_LOG_01** | Users can log a walking/running activity for a specific date |
| **FR_LOG_02** | Users can log distance in partial kilometers (e.g., 3.5 km) |
| **FR_LOG_03** | Users can view a calendar or timeline of their past logged activities |
| **FR_LOG_04** | Users can edit or delete past activity entries to correct errors |
| **FR_LOG_05** | System must automatically recalculate the user's Total Cumulative Distance immediately after any log update |
| **FR_LORE_01** | System must compare the User's Total Cumulative Distance against 171 Narrative Milestones |
| **FR_LORE_02** | System must unlock all Milestones whose distance threshold has been exceeded |
| **FR_LORE_03** | Users can view a list of all unlocked Milestones |
| **FR_LORE_04** | Users can read rich text descriptions associated with unlocked Milestones |
| **FR_LORE_05** | Users can view high-quality static imagery associated with unlocked Milestones |
| **FR_LORE_06** | Users can view the numeric distance remaining until the next locked Milestone |
| **FR_LORE_07** | Users can scroll ahead to see the titles of future locked Milestones to build anticipation |
| **FR_ADM_01** | Administrators can update Milestone descriptions via database/codebase deployment updates |
| **FR_ADM_02** | System allows for insertion of new "Intermediary" Milestones without breaking existing user progress logic |
| **FR_MAP_01** | Users can view their current calculated position projected onto a stylized map of Middle-earth |
| **FR_MAP_02** | Users can see a visual "breadcrumb" trail corresponding to their completed journey segments on the map |
| **FR_MAP_03** | Users can click interactive points on the map corresponding to unlocked milestones to view their details |
| **FR_PARTY_01** | Users can create a new Fellowship (party) and become the leader (multi-party membership supported) |
| **FR_PARTY_02** | Users can invite other users to join their Fellowship via shareable invite codes |
| **FR_PARTY_03** | Users can join a Fellowship by entering or clicking an invite code (joining is consent) |
| **FR_PARTY_04** | Users can view combined Fellowship progress (distance mode as party setting) |
| **FR_PARTY_05** | Users can see individual member contributions (color-coded per-member segments on Map) |
| **FR_PARTY_06** | Users can leave a Fellowship at any time (leave-distance behavior as party setting) |
| **FR_PARTY_07** | Party leader can kick members (with optional distance override) |
| **FR_PARTY_08** | Party selector on Journey and Map pages (hidden if no parties) |
| **FR_PARTY_09** | Party milestone modal on view switch (when new milestones passed since last view) |
| **FR_PARTY_10** | Party leader can update party settings after creation |
| **FR_PARTY_11** | Party leader can transfer leadership without leaving |
| **FR_PARTY_12** | Auto-dissolve empty parties when all members depart |

### NonFunctional Requirements

| ID | Requirement |
|----|-------------|
| **NFR_PERF_01** | PWA must load "Add Walk" modal and be ready for input in under 500ms on 4G network |
| **NFR_PERF_02** | Calendar calculation logic must render in under 200ms |
| **NFR_CONST_01** | All static image assets must be optimized (WebP/AVIF), <25MB per file |
| **NFR_CONST_02** | Database queries must act within Cloudflare D1 read/write limits |
| **NFR_REL_01** | Application behaves Online-First with explicit offline messaging |
| **NFR_REL_02** | UI Shell (HTML/CSS/JS) must be cached via Service Worker for instant load |
| **NFR_SEC_01** | User passwords must be salted and hashed (PBKDF2) before storage |
| **NFR_SEC_02** | API endpoints must validate session ownership for every request (IDOR prevention) |
| **NFR_PRIV_01** | Default state for all user data is Private with opt-in sharing for Fellowships |
| **NFR_ACC_01** | Color contrast must meet WCAG AA standards |
| **NFR_ACC_02** | All interactive elements minimum 44x44 CSS pixels |
| **NFR_TEST_01** | Maintain >90% test coverage (Backend & UI) |
| **NFR_BUILD_01** | <1s Time-To-Interactive on 4G networks |

### Additional Requirements

#### From Architecture (ADRs)

| ID | Category | Requirement |
|----|----------|-------------|
| **ADR_001** | Frontend Framework | Migrate to Preact for component architecture |
| **ADR_002** | Map Library | Use Konva.js for interactive Middle-earth map |
| **ADR_003** | State Management | Use Preact Signals for state management |
| **ADR_004** | Fellowship Data | Plan for new tables (parties, party_members) for Phase 3 |
| **ARCH_MIG_01** | Migration Strategy | Incremental adoption - new features in Preact, existing migrated when enhanced |
| **ARCH_STRUCT_01** | Client Structure | New client/src/ directory for Preact components |
| **ARCH_BUILD_01** | Build Config | Configure client build for Preact islands and Konva integration |
| **ARCH_TEST_01** | Visual Testing | Rely on Playwright visual regression (snapshot) tests for canvas |

#### From UX Design

| ID | Category | Requirement |
|----|----------|-------------|
| **UX_PROF_01** | Profile Button | Replace text button with circular avatar/icon |
| **UX_MODAL_01** | Modal Button Styling | Add background color + padding matching auth buttons |
| **UX_INPUT_01** | Distance Input | Add "km" suffix or placeholder for clarity |
| **UX_GOAL_01** | Next Goal Emphasis | Make first upcoming goal larger/highlighted |
| **UX_GOAL_02** | Goals Section Headers | Add location headers ("The Shire", "Bree", etc.) |
| **UX_ENTRY_01** | Quick Entry | Add +1km / +5km quick buttons in modal |
| **UX_PROG_01** | Progress Bar | Add simple progress bar under total distance |
| **UX_CSS_01** | CSS Variable System | Define color palette as CSS custom properties |
| **UX_THEME_01** | Dark Theme | Maintain dark fantasy theme inspired by LOTR |

### FR Coverage Map

| FR | Epic | Brief Description |
|----|------|-------------------|
| FR_AUTH_01 | Epic 1 | Account creation with email/password |
| FR_AUTH_02 | Epic 1 | Login to access private data |
| FR_AUTH_03 | Epic 1 | Email confirmation flow |
| FR_AUTH_04 | Epic 1 | Password reset via email |
| FR_AUTH_05 | Epic 1 | Strict data isolation enforcement |
| FR_LOG_01 | Epic 1 | Log walk for specific date |
| FR_LOG_02 | Epic 1 | Partial kilometer logging |
| FR_LOG_03 | Epic 1 | Calendar/timeline view |
| FR_LOG_04 | Epic 1 | Edit/delete past entries |
| FR_LOG_05 | Epic 1 | Auto-recalculate cumulative distance |
| FR_LORE_01 | Epic 1 | Compare distance vs 171 milestones |
| FR_LORE_02 | Epic 1 | Auto-unlock exceeded milestones |
| FR_LORE_03 | Epic 1 | View unlocked milestone list |
| FR_LORE_04 | Epic 1 | Read milestone descriptions |
| FR_LORE_05 | Epic 1 | View milestone imagery |
| FR_LORE_06 | Epic 1 | Distance to next milestone |
| FR_LORE_07 | Epic 1 | Preview future milestone titles |
| FR_ADM_01 | Epic 1 | Update milestone descriptions (via deployment) |
| FR_ADM_02 | Epic 1 | Insert intermediary milestones |
| FR_MAP_01 | Epic 2 | Position on Middle-earth map |
| FR_MAP_02 | Epic 2 | Visual breadcrumb trail |
| FR_MAP_03 | Epic 2 | Clickable waypoints |
| FR_PARTY_01 | Epic 3 | Create Fellowship (multi-party membership supported) |
| FR_PARTY_02 | Epic 3 | Invite users to Fellowship |
| FR_PARTY_03 | Epic 3 | Join Fellowship via invite code |
| FR_PARTY_04 | Epic 3 | View combined Fellowship progress (distance mode as party setting) |
| FR_PARTY_05 | Epic 3 | See individual member contributions (color-coded per-member segments on Map) |
| FR_PARTY_06 | Epic 3 | Leave Fellowship (leave-distance behavior as party setting) |
| FR_PARTY_07 | Epic 3 | Party leader can kick members (with distance override) |
| FR_PARTY_08 | Epic 3 | Party selector on Journey and Map pages |
| FR_PARTY_09 | Epic 3 | Party milestone modal on view switch |
| FR_PARTY_10 | Epic 3 | Party leader can update party settings after creation |
| FR_PARTY_11 | Epic 3 | Party leader can transfer leadership without leaving |
| FR_PARTY_12 | Epic 3 | Auto-dissolve empty parties when all members depart |
| FR_PARTY_13 | Epic 3 (Future) | User custom map icon for visual distinction |
| FR_PARTY_14 | Epic 3 (Future) | Fellowship profile icon |

## Epic List

### Epic 1: Phase 1 Polish & Completion (Issue #150)

**Goal:** Complete all remaining Phase 1 polish items - autonomous registration via email confirmation, intermediary goals to improve narrative pacing, missing milestone photos, UX improvements, and frontend infrastructure setup for future development.

**FRs Covered:** FR_AUTH_01, FR_AUTH_02, FR_AUTH_03, FR_AUTH_04, FR_AUTH_05, FR_LOG_01-05, FR_LORE_01-07, FR_ADM_01, FR_ADM_02

**Includes:**
- Email confirmation flow (#149)
- Intermediary goals (#140)
- Missing milestone photos (#105)
- UX polish (modal buttons, km suffix, quick entry, goal headers, progress bar, profile icon)
- Setup `client/` Preact infrastructure (foundational for future work)
- Content/description updates as needed

**Status:** Mostly complete, finishing touches

---

### Epic 2: Interactive Journey Map (Phase 2 Atlas) (Issue #151)

**Goal:** Users can view their journey progress on an interactive, zoomable map of Middle-earth, see their breadcrumb trail, and click waypoints to explore unlocked milestones.

**FRs Covered:** FR_MAP_01, FR_MAP_02, FR_MAP_03

**Tech:** Konva.js (ADR-002), Preact components

**Status:** New feature

---

### Epic 3: Fellowship Features (Phase 3) (Issue #152)

**Goal:** Users can create/join multiple parties (Fellowships), configure party settings (distance mode, leave behavior), view combined group progress on Journey and Map pages, and share their journey with friends for social motivation.

**FRs Covered:** FR_PARTY_01 through FR_PARTY_12 (FR_PARTY_13, FR_PARTY_14 are future follow-ups)

**Tech:** ADR-004 (parties, party_members tables with party-level settings)

**Includes:**
- Create/invite/view/leave/kick party features (#139)
- Multi-party membership (users can belong to multiple parties)
- Party settings: distance mode (cumulative/incremental), leave-distance behavior (keep/remove) — configurable at creation and updatable after
- Party selector on Journey and Map pages (hidden if user has no parties)
- Per-member color-coded contribution segments on Map view
- Party milestone modal triggered on view switch (when party has passed a new milestone since last viewed)
- Shared progress tracking with leader-configured calculation mode
- Leadership transfer without leaving
- Auto-dissolution of empty parties
- Re-join support (users can re-join parties they previously left/were kicked from)
- Navigation link to Fellowships page in DrawerIsland
- 3-page fellowship flow: list (`/party`) → detail (`/party/:id`) → management (`/party/:id/manage`, leader only)
- Deep-link invite flow: shareable invite URLs (`/party/join/:inviteCode`) with preview for both authenticated and non-authenticated users
- Activity feed on fellowship detail page
- Privacy controls (opt-in sharing)

**Future follow-ups:** User custom map icons (FR_PARTY_13), Fellowship profile icons (FR_PARTY_14)

**Status:** New feature

---

### Epic 4: Admin Portal (Post-Fellowship) (Issue #153)

**Goal:** Dedicated admin interface for content management - updating milestone descriptions, managing goals, and viewing system metrics.

**FRs Covered:** Enhanced admin capabilities via dedicated UI

**Status:** Future enhancement, after Fellowship

---

### Epic 5: Races (Competitive Events) (Issue #154)

**Goal:** Time-limited competitive events where users can join races and compete for progress within a specific timeframe.

**FRs Covered:** Race feature set from Issue #139

**Tech:** New `races` table with start_date, end_date, and leaderboard tracking

**Status:** New feature, after Fellowship

---

## Stories

### Epic 1: Phase 1 Polish & Completion

#### Story 1.1: Preact Infrastructure Setup (Issue #155)

**Priority:** P0 (Blocker)

**Description:** Set up the foundational Preact build infrastructure in `client/src/` to enable island-based component development. This is a prerequisite for all new frontend work.

**Acceptance Criteria:**
- [ ] Create `client/` directory structure: `client/src/`, `client/src/components/`, `client/src/islands/`
- [ ] Configure esbuild (or vite) for Preact compilation and Konva map support
- [ ] Configure TypeScript for client code (separate tsconfig.client.json if needed)
- [ ] Create npm scripts: `build:client`, `dev:client` (watch mode)
- [ ] Create a sample proof-of-concept island component (Note: HelloWorld POC has been removed after validation)
- [ ] Document the island mounting pattern in `docs/architecture.md`
- [ ] Verify build outputs to `public/js/islands/` or equivalent assets location

**Technical Notes:**
- Keep Konva map integration compatible with the current runtime and package versions
- Follow ADR-001 (Preact) and ARCH_BUILD_01

**Dependencies:** None (foundational)

---

#### Story 1.2: Email Service Migration (Issue #156)

**Priority:** P0 (Blocker for Auth Stories)

**Description:** Migrate from Cloudflare Email Routing to a transactional email service (Resend or SendGrid) to enable reliable email confirmation and password reset flows.

**Acceptance Criteria:**
- [ ] Select and configure transactional email provider (Resend recommended)
- [ ] Create reusable `sendEmail()` utility in `src/email-utils.ts`
- [ ] Configure environment secrets for API keys via Wrangler
- [ ] Create email templates: confirmation, password reset
- [ ] Implement rate limiting for email sends (prevent abuse)
- [ ] Update `docs/` with email configuration instructions
- [ ] Test email delivery to multiple providers (Gmail, Outlook, etc.)

**Technical Notes:**
- Resend has a generous free tier and simple API
- Store API key as Worker secret, not in wrangler.json

**Dependencies:** None

---

#### Story 1.3: Email Confirmation Flow (Issue #149)

**Priority:** P1

**Description:** Implement email confirmation requirement for new account registration, replacing manual admin approval with autonomous user activation.

**Acceptance Criteria:**
- [ ] Generate secure confirmation token on registration (crypto.randomUUID or similar)
- [ ] Store token with expiration (24h) in `email_confirmation_tokens` table
- [ ] Send confirmation email with unique link immediately after registration
- [ ] Create `/confirm-email?token=xxx` endpoint to validate token and activate account
- [ ] Update registration UI to show "Check your email" message after signup
- [ ] Prevent login until email is confirmed (return appropriate error)
- [ ] Allow resend of confirmation email (with rate limiting)
- [ ] Clean up expired tokens via scheduled task or on-demand

**FRs:** FR_AUTH_01, FR_AUTH_03

**Dependencies:** Story 1.2 (Email Service)

---

#### Story 1.4: Intermediary Goals System (Issue #140)

**Priority:** P1

**Description:** Enable insertion of new narrative milestones between existing goals to improve story pacing and density, ensuring no narrative gaps exceed 70km.

**Acceptance Criteria:**
- [ ] Add `image_id` column to goals table (TEXT) to explicitly link images
- [ ] Create migration script to populate `image_id` for existing goals (using ID cast to text)
- [ ] Analyze existing goals to identify any distance gaps greater than 70km (~43 miles)
- [ ] Insert new intermediary goals (with `image_id` as NULL) to ensure no gap exceeds this threshold
- [ ] Verify sorting logic (ensure strict `ORDER BY distance ASC` is used)
- [ ] Update frontend to handle goals with NULL `image_id` gracefully
- [ ] Document the process for adding intermediary goals

**FRs:** FR_ADM_02

**Dependencies:** None

---

#### Story 1.5: Missing Milestone Images (Issue #105)

**Priority:** P2

**Description:** Identify and add missing images for all 171 milestones, ensuring every goal has associated high-quality imagery served via WebP with optimized loading.

**Acceptance Criteria:**
- [ ] Audit all 171 goals and ensure every single one has a valid `image_id` (no NULLs).
- [ ] Source/generate images for missing milestones (license-appropriate).
- [ ] Optimize all images (new and existing) to WebP format (<25MB high-res).
- [ ] Create thumbnail versions (<20KB, ~400px, Quality 60) for lazy loading (blur-up).
- [ ] Update database `image_id`s to use clean slugs (e.g., `woody-end`) instead of IDs.
- [ ] Update frontend to use WebP, implement lazy loading/blur-up pattern, and handle detail vs list views.
- [ ] **Refactoring Decision**: Refactor to Preact only if state complexity warrants it; otherwise, minimally patch legacy JS.

**FRs:** FR_LORE_05

**Dependencies:** Story 1.4 (Intermediary Goals)

---

#### Story 1.6: Image Optimization Script (Issue #157)

**Priority:** P2

**Description:** Create automated script to process and optimize milestone images for production use.

**Acceptance Criteria:**
- [ ] Create Node.js script in `scripts/optimize-images.js`
- [ ] Input: source images folder, Output: optimized WebP + thumbnails
- [ ] Generate high-res WebP (max 2560px width, quality 90) - Only downscale if > 4K
- [ ] Generate thumbnail WebP (max 400px width, quality 60, <20KB target) for lazy loading (blur-up)
- [ ] Log optimization stats (original size → compressed size)
- [ ] Add npm script: `npm run optimize:images`
- [ ] Document usage in README or docs

**NFRs:** NFR_CONST_01

**Dependencies:** None

---

#### Story 1.7: UX Polish - Modal & Input Improvements (Issue #158)

**Priority:** P2

**Description:** Implement UX improvements for the Add Walk modal: styled buttons, km suffix, and quick entry buttons.

**Acceptance Criteria:**
- [ ] **Modal Button Styling**: "Add Walk" and "Cancel" buttons must have background colors, padding, and hover states matching auth buttons (no transparent text-only buttons).
- [ ] **Distance Input Clarity**: Input field must clearly indicate "km" via suffix or placeholder.
- [ ] **Quick Entry**: Add "+1km" and "+5km" buttons that increment the input value.
- [ ] **Touch Friendliness**: All interactive elements must be ≥44x44 CSS pixels.
- [ ] **Mobile Viewport**: Layout must not break and must remain functional on small screens (iPhone SE / 320px).

**FRs:** UX_MODAL_01, UX_INPUT_01, UX_ENTRY_01

**Dependencies:** None

---

#### Story 1.8: UX Polish - Goals Display Improvements (Issue #159)

**Priority:** P2

**Description:** Enhance goals display with next goal emphasis and segment progress bar.

**Acceptance Criteria:**
- [ ] **Next Goal Emphasis**: Visually highlight the immediate next upcoming goal.
- [ ] **Next Goal Progress Bar**: Display a progress bar on the next goal card showing progress from the previous milestone to the current one.
- [ ] **Responsiveness**: Ensure highlights and progress bar render correctly on mobile.
- [ ] **Accessibility**: Ensure proper contrast (WCAG AA).

**FRs:** UX_GOAL_01, UX_PROG_01

**Dependencies:** None

---

#### Story 1.9: UX Polish - Profile Icon & CSS Variables (Issue #160)

**Priority:** P3

**Description:** Replace text profile button with avatar icon and establish CSS custom properties system.

**Acceptance Criteria:**
- [ ] Replace "Profile" text button with circular avatar/icon
- [ ] Use user initials or default icon if no avatar
- [ ] Define color palette as CSS custom properties in `main.css`
- [ ] Document color variables for consistency
- [ ] Maintain dark fantasy LOTR-inspired theme (UX_THEME_01)

**FRs:** UX_PROF_01, UX_CSS_01, UX_THEME_01

**Dependencies:** None

---

### Epic 2: Interactive Journey Map

#### Story 2.1: Map Page Shell & Navigation (Issue #161)

**Priority:** P1

**Description:** Create the Map page route and basic shell layout that will host the interactive Konva canvas.

**Acceptance Criteria:**
- [ ] Create `/map` route in Worker
- [ ] Create map page HTML template with navigation back to dashboard
- [ ] Add "Map" navigation link to main dashboard header
- [ ] Page includes `<div id="map-root">` container for Preact island
- [ ] Page loads map island JS bundle
- [ ] Responsive container that fills available viewport

**Dependencies:** Story 1.1 (Preact Infrastructure)

---

#### Story 2.2: Map Canvas & Base Image Layer (Issue #162)

**Priority:** P1

**Description:** Implement the Konva Stage with pan/zoom controls and the base Middle-earth map image.

**Acceptance Criteria:**
- [ ] Create `MapIsland` Preact component in `client/src/islands/`
- [ ] Initialize Konva Stage with responsive dimensions
- [ ] Load Middle-earth base map image as background layer
- [ ] Implement pan (drag) functionality
- [ ] Implement zoom (pinch/wheel) with min/max bounds
- [ ] Zoom range: 0.5x to 3x (configurable)
- [ ] Smooth zoom transitions
- [ ] Mobile touch gestures supported

**FRs:** FR_MAP_01

**Tech:** Konva.js (imperative API)

**Dependencies:** Story 2.1, Story 1.1

---

#### Story 2.3: Journey Path Rendering (Issue #163)

**Priority:** P1

**Description:** Render the user's journey as a visual breadcrumb trail on the map showing completed segments.

**Acceptance Criteria:**
- [ ] Define path coordinates for the complete Hobbiton→Mordor route
- [ ] Render completed path segments as colored line (gold/amber theme)
- [ ] Path renders from journey start to user's current position
- [ ] Future path uses dashed styling for "walking" aesthetic with reviewed visibility (not too faint)
- [ ] Path updates when user progress changes
- [ ] Uncompleted path is shown as a limited near-term faded context segment (full remaining route is not required)

**Implementation Clarification (review-approved):**
- Imperative Konva API is the approved rendering approach for this story due runtime compatibility constraints validated during Story 2.2 implementation.

**FRs:** FR_MAP_02

**Dependencies:** Story 2.2

---

#### Story 2.4: Current Position Marker (Issue #164)

**Priority:** P1

**Description:** Display the user's current calculated position on the map with a distinctive marker.

**Acceptance Criteria:**
- [ ] Calculate user position along path based on total distance
- [ ] Render position marker (custom icon - Fellowship member/ring/etc.)
- [ ] Marker positioned correctly on the route path
- [ ] Marker visible at all zoom levels (scale appropriately)
- [ ] Smooth animation when position updates
- [ ] Position tooltip showing current km on hover/tap

**FRs:** FR_MAP_01

**Dependencies:** Story 2.3

---

#### Story 2.5: Waypoint Markers (Milestones on Map) (Issue #165)

**Priority:** P1

**Description:** Display interactive waypoint markers for milestones on the map, with unlocked/locked visual states.

**Acceptance Criteria:**
- [ ] Place waypoint markers at milestone coordinates along path
- [ ] **Waypoint visibility logic:**
  - At low zoom: Show only "major" waypoints (configurable flag or every Nth waypoint)
  - At high zoom: Show all waypoints in visible area
- [ ] Unlocked waypoints: Full color icon, interactive
- [ ] Locked waypoints: Grayed/muted icon, non-interactive (or shows "locked" tooltip)
- [ ] Icons scaled appropriately for current zoom level
- [ ] Waypoint clustering/hiding at low zoom to prevent clutter

**FRs:** FR_MAP_03

**Dependencies:** Story 2.4

---

#### Story 2.6: Waypoint Detail Popup (Issue #166)

**Priority:** P2

**Description:** When user clicks an unlocked waypoint, show a popup/modal with milestone details.

**Acceptance Criteria:**
- [ ] Click unlocked waypoint → opens detail panel/popup
- [ ] Panel shows: milestone name, distance, description excerpt, thumbnail image
- [ ] "View Full Details" link navigates to full milestone page
- [ ] Panel dismissible (click outside, X button, or ESC)
- [ ] Panel positioned near clicked waypoint (doesn't cover it)
- [ ] Mobile: Panel slides up from bottom as sheet

**FRs:** FR_MAP_03, FR_LORE_03, FR_LORE_04

**Dependencies:** Story 2.5

---

#### Story 2.7: Map State Management (Issue #167)

**Priority:** P2

**Description:** Implement Preact Signals for map state and data fetching.

**Acceptance Criteria:**
- [ ] Create signals for: userProgress, milestones, mapViewState (zoom, pan)
- [ ] Fetch user progress data from API on mount
- [ ] Fetch milestone coordinate data (cacheable, static)
- [ ] Handle loading states (skeleton/spinner)
- [ ] Handle error states (retry option)
- [ ] Persist last map position to localStorage (resume where left off)

**Tech:** Preact Signals (ADR-003)

**Dependencies:** Story 2.2

---

#### Story 2.8: Map Walk Logging (Issue #TBD)

**Priority:** P2

**Description:** Allow users to log daily walk distances directly from the Map view via a toggleable, shared calendar component.

**Acceptance Criteria:**
- [ ] Add "Log Walk" / "Calendar" floating action button (FAB) or header button to Map view.
- [ ] Clicking button toggles the visibility of the Date/Calendar picker (shared component).
- [ ] Calendar overlay is dismissible (X button or click outside) to maximize map view.
- [ ] Entering a distance updates the global `userProgress` state.
- [ ] **Reactive Updates**:
    - [ ] Path updates (completed vs future line).
    - [ ] User marker moves to new location.
    - [ ] Map pans/zooms to center on new user location.
- [ ] **Milestone Trigger**: If new distance unlocks a goal, trigger the standard "Goal Unlocked" modal.
- [ ] **Component Reuse**: Refactor existing Calendar/Input implementation to be reusable across Dashboard and Map.

**Dependencies:** Story 2.7, Story 1.1

---

#### Story 2.9: Map Visual Testing (Issue #168)

**Priority:** P2

**Description:** Create Playwright visual regression tests for map rendering.

**Acceptance Criteria:**
- [ ] Create snapshot tests for map at default zoom
- [ ] Create snapshot tests for map at zoomed in/out states
- [ ] Test path rendering with mock progress data
- [ ] Test waypoint marker visibility at different zoom levels
- [ ] Test map calendar toggle interaction
- [ ] Document snapshot update process
- [ ] Tests run in CI pipeline

**NFRs:** ARCH_TEST_01, NFR_TEST_01

**Dependencies:** Story 2.8

---

#### Story 2.10: User Goal Visibility Preference (Issue #TBD)

**Priority:** P2

**Description:** Allow users to choose whether future goals/waypoints appear locked or unlocked based on their personal motivation style.

**Acceptance Criteria:**
- [ ] Add `show_future_goals_unlocked` INTEGER column to `users` table (default: 1/TRUE)
- [ ] Create database migration for the new column
- [ ] Add toggle in Profile Settings modal: "Preview all milestones"
- [ ] Default behavior (toggle ON): All goals display as unlocked (preserves current behavior)
- [ ] When toggle OFF: Future goals (distance > user totalDistance) display as locked/grayed
- [ ] Preference applies to:
    - [ ] Map waypoint markers (Story 2.5)
    - [ ] Journey/Dashboard goals list view
- [ ] Persist preference to database on toggle change
- [ ] Load preference on session start

**Technical Notes:**
- Default FALSE preserves existing functionality for current users
- Cross-cutting feature: affects both Map and Journey views
- Profile modal already exists; add toggle to existing UI

**Dependencies:** None (can be implemented independently)

---

### Epic 3: Fellowship Features

#### Story 3.1: Fellowship Database Schema (Issue #169)

**Priority:** P0 (Blocker)

**Description:** Create database tables for Fellowship (party) functionality with party-level settings.

**Acceptance Criteria:**
- [ ] Create `parties` table: id, name, leader_id, created_at, invite_code (unique), **distance_mode** (TEXT, default 'incremental'), **leave_distance_behavior** (TEXT, default 'keep'), **dissolved_at** (DATETIME, default NULL)
- [ ] Create `party_members` table: id, party_id, user_id, joined_at, **distance_at_join** (DECIMAL), role (leader/member), status (active/left/**kicked**), **last_viewed_distance** (DECIMAL, default 0), **departed_at** (DATETIME, default NULL), **distance_kept** (BOOLEAN, default NULL — set on departure to record whether the member's contribution was kept or removed, capturing any kick override)
- [ ] Create `party_progress_log` table: id, party_id, logged_by_user_id, distance, **date** (DATE — correlates with the progress table entry), logged_at (for activity feed and contribution audit trail)
- [ ] Add indexes for common queries (party lookups, member listings, multi-party user lookups)
- [ ] Create migration file in `migrations/` folder
- [ ] Document schema in `docs/data-models.md`

**FRs:** FR_PARTY_01, FR_PARTY_04, FR_PARTY_06, FR_PARTY_07, FR_PARTY_09, FR_PARTY_12, ADR-004

**Technical Notes:**
- `distance_at_join` stores the user's total distance at the moment they join, enabling both "cumulative" and "incremental" progress modes.
- `distance_mode` on `parties` determines how party progress is calculated: 'cumulative' (all-time totals) or 'incremental' (distance since joining). Set by the leader at party creation, updatable via settings API.
- `leave_distance_behavior` on `parties` determines what happens to a member's contributed distance when they leave: 'keep' (distance remains) or 'remove' (distance is subtracted). Set by the leader at party creation, updatable via settings API.
- `last_viewed_distance` on `party_members` tracks the party's total distance as of the user's last view of that party, enabling milestone modal display when switching between party views.
- `departed_at` on `party_members` records when a member left or was kicked. Used with `distance_at_join` to calculate departed member contributions from the `progress` table without needing a separate `distance_at_departure` column.
- `distance_kept` on `party_members` (BOOLEAN, default NULL) — set on departure to record whether the member's contributed distance was kept (`true`) or removed (`false`) from the party total. This captures any kick-specific distance override (Story 3.5) so that later progress calculations don't lose the disposition decision. NULL for active members.
- `dissolved_at` on `parties` is set when a party is auto-dissolved (all members departed). Dissolved parties cannot be re-joined.
- `status` supports 'kicked' to distinguish leader-initiated removals from voluntary leaves.
- **Re-join:** When a user re-joins a party they previously left/were kicked from, a **new** `party_members` record is created. The old record is preserved with `departed_at` set for contribution history. No unique constraint on (party_id, user_id) — multiple records per user per party are expected.
- Index on `party_members(user_id)` is important for efficiently querying all parties a user belongs to (multi-party membership).
- `party_progress_log` has a `date` column (DATE) correlating with the `progress` table, enabling accurate updates when walks are edited or deleted.

**Dependencies:** None

**change-impact:** Requirements expanded — `departed_at` added to `party_members`, `dissolved_at` added to `parties`. Re-join creates new records (not updating old). `party_progress_log` serves as contribution audit trail. All downstream stories (3.2–3.9) must reference the updated schema.

---

#### Story 3.2: Create Fellowship API (Issue #170)

**Priority:** P1

**Description:** API endpoint for creating a new Fellowship with the current user as leader, including party settings configuration.

**Acceptance Criteria:**
- [ ] POST `/api/party` - Create new party
- [ ] Request body: { name: string, **distance_mode?: 'cumulative' | 'incremental'**, **leave_distance_behavior?: 'keep' | 'remove'** }
- [ ] `distance_mode` defaults to 'incremental' if not provided
- [ ] `leave_distance_behavior` defaults to 'keep' if not provided
- [ ] Generate unique invite code (8 char alphanumeric) - **Must be cryptographically secure/non-enumerable**
- [ ] Set creator as leader in party_members with `distance_at_join` = current total distance and `last_viewed_distance` = 0
- [ ] Return party details including invite code and configured settings
- [ ] Validate: name required, max 50 chars
- [ ] Validate: distance_mode must be 'cumulative' or 'incremental' if provided
- [ ] Validate: leave_distance_behavior must be 'keep' or 'remove' if provided
- [ ] Return 401 if not authenticated
- [ ] Users can create multiple parties (no limit on party creation)

**FRs:** FR_PARTY_01, FR_PARTY_04, FR_PARTY_06

**Dependencies:** Story 3.1

**change-impact:** Request body expanded with `distance_mode` and `leave_distance_behavior` settings. Response includes settings. Multi-party creation explicitly supported.

---

#### Story 3.3: Invite & Join Fellowship API (Issue #171)

**Priority:** P1

**Description:** API endpoints for inviting users, joining via invite code, and listing user's parties. Users can join multiple parties.

**Acceptance Criteria:**
- [ ] GET `/api/party/join/:inviteCode` - Preview party before joining (name, member count, current distance, **distance_mode**, **leave_distance_behavior**)
- [ ] POST `/api/party/join/:inviteCode` - Join party via invite code
- [ ] On join: Record `distance_at_join` = user's current total distance, `last_viewed_distance` = 0, `departed_at` = NULL
- [ ] **Re-join:** If user previously left/was kicked from the party, create a **new** `party_members` record (old record preserved for contribution history). Return 400 if party is dissolved.
- [ ] POST `/api/party/:id/invite` - Generate new invite code (leader only). Response includes the new invite code **and** the full shareable invite URL (format: `{request.origin}/party/join/{inviteCode}`)
- [ ] **GET `/api/user/parties`** - Return list of all parties the user is an active member of (id, name, role, distance_mode, leave_distance_behavior, active_member_count). Exclude dissolved parties by default. Accept optional `?include_dissolved=true` query parameter to also return dissolved parties (with `dissolved_at` field) for the Fellowships list page history section (Story 3.7).
- [ ] Validate: Cannot join the same party twice (no duplicate active memberships)
- [ ] **Allow joining multiple different parties** — no single-party restriction
- [ ] Return 404 for invalid invite codes
- [ ] **Security:** Verify implicit opt-in (joining is the consent action)
- [ ] **Security:** Validate Invite Code integrity (prevent enumeration/brute-force)

**FRs:** FR_PARTY_01, FR_PARTY_02, FR_PARTY_03, FR_PARTY_08

**Dependencies:** Story 3.2

**change-impact:** Added `GET /api/user/parties` endpoint. Re-join creates new record (not update). `departed_at` initialized to NULL. Dissolved party check on join.

---

#### Story 3.4: Fellowship Progress Calculation API (Issue #172)

**Priority:** P1

**Description:** API endpoint to calculate and return combined Fellowship progress using the party's configured distance mode.

**Acceptance Criteria:**
- [ ] GET `/api/party/:id/progress` - Get party progress
- [ ] **Distance mode is read from the party's `distance_mode` setting** (not a query param) — leader configures this at creation
- [ ] **Cumulative Mode:** Sum of all active members' total distances (all-time)
- [ ] **Incremental Mode:** Sum of (member total distance - distance_at_join) for each active member (only counts progress since joining)
- [ ] **Handle left/kicked members based on `leave_distance_behavior` setting:** If 'keep', include departed members' contributed distance calculated from `distance_at_join` + `departed_at` via the `progress` table. If 'remove', exclude them entirely.
- [ ] Return: total_distance, member_count, calculated_position (milestone), distance_mode, leave_distance_behavior
- [ ] Include breakdown by member: { user_id, display_name, contribution, status, **color** }
- [ ] For incremental mode, active member `contribution` = current total - distance_at_join
- [ ] For departed members with 'keep' behavior: **incremental** `contribution` = SUM(progress.distance WHERE user_id = ? AND date BETWEEN joined_at AND departed_at); **cumulative** `contribution` = SUM(progress.distance WHERE user_id = ? AND date <= departed_at)
- [ ] For departed members with 'keep' behavior and **kick distance override (`distance_kept = false`):** exclude that member's contribution entirely regardless of party setting
- [ ] For re-joined members with multiple `party_members` records (and 'keep' behavior): sum contributions from all records (old departed + current active), but avoid double-counting in cumulative mode (use only the current active record's total for cumulative; sum incremental contributions across all records for incremental)
- [ ] **Walk logging integration (cross-cutting):** When a walk is logged via `POST /api/calendar-progress`, automatically insert a `party_progress_log` entry for each of the user's active party memberships. When a walk is edited via `PUT /api/calendar-progress`, update corresponding `party_progress_log` entries. When a walk is deleted via `DELETE /api/calendar-progress`, remove corresponding `party_progress_log` entries.
- [ ] **`GET /api/party/:id/activity`** — Return the last N entries from `party_progress_log` for the given party (for the activity feed on the detail page, Story 3.8). Format: `{ user_id, display_name, distance, logged_at }`. Only accessible to active party members.
- [ ] **Update `last_viewed_distance` for the requesting user** to current total_distance (for milestone notification tracking)
- [ ] **Return `newly_passed_milestones`** — list of milestones between the user's previous `last_viewed_distance` and the current total_distance
- [ ] Cache calculation for 5 minutes (invalidate on new log)
- [ ] **Security:** Validate session user is a member of `party_id` (IDOR Prevention)
- [ ] **Privacy:** Ensure individual progress is ONLY exposed to confirmed party members

**FRs:** FR_PARTY_04, FR_PARTY_05, FR_PARTY_06, FR_PARTY_09

**Technical Notes:**
- The `distance_at_join` field enables fair contribution tracking regardless of when members joined.
- The `leave_distance_behavior` setting governs how departed member distance is handled in progress calculations. The `distance_kept` column on `party_members` records the actual disposition at departure time.
- **No `distance_at_departure` column is needed.** Departed member contribution is calculated from `distance_at_join` + `departed_at` timestamps using the existing `progress` table. For incremental mode, departed contribution = SUM(progress.distance WHERE date BETWEEN joined_at AND departed_at). For cumulative mode, departed contribution = SUM(progress.distance WHERE date <= departed_at). Use `distance_kept` column (not the current party setting) to determine whether to include.
- For re-joined members: multiple `party_members` records may exist per user per party. For incremental mode with 'keep': sum incremental contributions across all records. For cumulative mode: use only the current active record's total (not sum across all records, to avoid double-counting).
- `last_viewed_distance` update enables FR_PARTY_09 (milestone modal on party view switch, owned by Story 3.6).
- Member `color` is computed deterministically from `user_id % palette_size` for stability across sessions and re-joins.
- **Walk logging integration (cross-cutting, owned by this story):** When a walk is logged via `POST /api/calendar-progress`, insert a `party_progress_log` entry (with `date` column) for each of the user's active parties. On `PUT /api/calendar-progress`, update corresponding entries. On `DELETE /api/calendar-progress`, remove corresponding entries. This is the only Epic 3 change to existing code.
- **`GET /api/party/:id/activity`** endpoint returns the last N entries from `party_progress_log` for the activity feed on the detail page (Story 3.8).
- **Parameterized routing:** The Worker router in `src/index.ts` uses exact string matching. Story 3.2 (first party API story) should add parameterized route matching as a prerequisite for all subsequent party endpoints.

**Dependencies:** Story 3.3

**change-impact:** Departed member calculation formula corrected — incremental mode uses date-range SUM (no distance_at_join subtraction for departed members). Cumulative mode re-join double-counting prevention specified. Walk logging → party_progress_log integration elevated from tech note to explicit AC. Activity feed API endpoint added. Member color assignment changed from join-order to user_id-based for stability. `distance_kept` column used for progress calculations instead of current party setting.

---

#### Story 3.5: Leave, Kick & Party Management API (Issue #173)

**Priority:** P1

**Description:** API endpoints for members to leave a Fellowship, for leaders to kick members, update party settings, transfer leadership, and handle party dissolution.

**Acceptance Criteria:**
- [ ] POST `/api/party/:id/leave` - Leave party
- [ ] Set member status to 'left', **`departed_at` = current timestamp**, and **`distance_kept`** based on the party's `leave_distance_behavior` setting (soft delete, preserve history)
- [ ] **Apply party's `leave_distance_behavior` setting:** If 'keep', set `distance_kept = true`. If 'remove', set `distance_kept = false`.
- [ ] If leader leaves: transfer leadership to oldest active member, or dissolve if no active members remain
- [ ] **Auto-dissolve:** If no active members remain after departure, set `parties.dissolved_at` = current timestamp (soft-delete the party). Use a D1 batch transaction to prevent race conditions with concurrent departures.
- [ ] Return success confirmation
- [ ] Validate: User must be active member of party (IDOR Check)
- [ ] POST `/api/party/:id/kick/:userId` - **Kick a member (leader only)**
- [ ] Set kicked member's status to 'kicked' and **`departed_at` = current timestamp**
- [ ] **Accept optional `removeDistance` boolean** in request body to override the party's `leave_distance_behavior` setting (e.g., leader can force-remove a cheater's distance even if the default is 'keep')
- [ ] If `removeDistance` is not provided, fall back to the party's `leave_distance_behavior` setting
- [ ] **Set `distance_kept`** on the kicked member's record: `true` if distance is being kept, `false` if removed. This preserves the disposition decision for future progress calculations.
- [ ] Return 403 if non-leader attempts to kick
- [ ] Return 400 if leader tries to kick themselves (must use leave instead)
- [ ] **Auto-dissolve:** Check if no active members remain after kick. If so, set `parties.dissolved_at`.
- [ ] **PUT `/api/party/:id/settings`** - Update party settings (leader only)
- [ ] Accept JSON body with optional `{ distance_mode?: 'cumulative' | 'incremental', leave_distance_behavior?: 'keep' | 'remove' }`
- [ ] Validate values. Return 403 if non-leader. Return 404 if party not found or dissolved.
- [ ] **POST `/api/party/:id/transfer-leadership`** - Transfer leadership to another active member (leader only)
- [ ] Accept JSON body with `{ new_leader_id: number }`
- [ ] Validate new_leader_id is an active member of the party
- [ ] Update old leader's role to 'member', new leader's role to 'leader', update `parties.leader_id`
- [ ] Return 403 if non-leader. Return 400 if target is not an active member.

**FRs:** FR_PARTY_06, FR_PARTY_07, FR_PARTY_10, FR_PARTY_11, FR_PARTY_12

**Dependencies:** Story 3.3

**change-impact:** Added settings update API (FR_PARTY_10), leadership transfer (FR_PARTY_11), auto-dissolution (FR_PARTY_12). `departed_at` set on leave/kick. Story title updated to reflect expanded scope.

---

#### Story 3.6: Fellowship UI - Journey & Map Party Selector (Issue #174)

**Priority:** P1

**Description:** Add a party selector to the Journey and Map pages allowing users to toggle between personal distance and any of their parties' combined distance. Hidden if user has no parties.

**Acceptance Criteria:**
- [ ] Use `GET /api/user/parties` (from Story 3.3) to fetch the user's active party list
- [ ] **Party selector** implemented as a new Preact island (`PartySelector`) mounted above the main content area on both Journey and Map pages
- [ ] If user is a member of at least one party: Show a selector/dropdown on **Journey page** to choose between "Personal" and each party name
- [ ] If user is a member of at least one party: Show a selector/dropdown on **Map page** to choose between "Personal" and each party name
- [ ] **Selector is hidden** if user is not a member of any party
- [ ] When a party is selected, display a visual indicator banner (e.g., "👥 Viewing: [Fellowship Name]") to distinguish from personal view
- [ ] When a party is selected on **Journey page**: Display the party's combined distance and milestone progress instead of personal (NextGoalCard and UpcomingGoalCard re-render with party progress). Show brief loading indicator during data fetch.
- [ ] When a party is selected on **Map page**: Display the party's combined distance path, showing **per-member contributed segments with color-coded lines** (each member assigned a distinct color computed deterministically from `user_id % palette_size` for stability across sessions and re-joins). Include a map legend showing member name + color swatch when in party view.
- [ ] **Color palette:** Define a 12-color maximum distinctness palette. For members beyond 12, cycle with a different line pattern (dashed). Departed members whose contributions are kept: show in muted/desaturated version of their color. Departed with removed contributions: don't show.
- [ ] When switching to a party view: Call GET `/api/party/:id/progress` and check `newly_passed_milestones` — if any exist, display the **milestone modal for the latest passed milestone** (FR_PARTY_09). This is the primary owner of the party-switch milestone modal behavior.
- [ ] **Do not re-trigger** milestone modal when simply toggling between parties at different positions — only trigger when the party has progressed past a new milestone since the user's last view. The `last_viewed_distance` is updated on each progress API call, ensuring the modal fires at most once per milestone per party per user.
- [ ] Page focus + 60-second polling for party data (consistent with Story 3.8 refresh pattern)
- [ ] Persist the user's last selected view (personal/party) in localStorage for page reload continuity. **Edge case:** If persisted party ID returns 403/404 from API (user kicked, party dissolved), fall back to "Personal" view silently and clear the stale localStorage value.

**FRs:** FR_PARTY_04, FR_PARTY_05, FR_PARTY_08, FR_PARTY_09

**Dependencies:** Story 3.4, Story 1.1

**change-impact:** This story replaces the original "Dashboard Integration" scope. Now covers multi-party selection on Journey/Map pages, per-member **color-coded** map segments (deterministic colors from user ID), party milestone modal triggering (FR_PARTY_09 — primary owner; Story 3.9 adds only proactive push notifications), map legend, loading states, stale localStorage handling. Uses `GET /api/user/parties` from Story 3.3. Significantly expanded from original spec.

---

#### Story 3.7: Fellowship UI - Fellowships Pages (Issue #175)

**Priority:** P2

**Description:** Fellowship UI flow with four routes: three pages accessible from the navigation drawer (list → detail → management), plus a join landing page for deep-link invite URLs. The flow is: nav drawer → Fellowships list (select or create) → Fellowship detail (members, contributions, progress, milestone) → Fellowship management (leader only). Additionally, `/party/join/:inviteCode` serves as a deep-link landing page when users click a shared invite link. Each route renders via SSR (following `renderLayout()` pattern) with a corresponding Preact island.

**Acceptance Criteria:**

**Page 1: Fellowships List (`/party`)**
- [ ] Create `/party` route (titled "Fellowships") with SSR shell (new `renderPartyListPage.ts` following `renderLayout()` pattern) and a Preact island
- [ ] **Add "Fellowships" link to the DrawerIsland navigation** (alongside Journey and Map links)
- [ ] Page shows a **list of all parties** the user belongs to (via `GET /api/user/parties` from Story 3.3), each showing party name and **active member count**
- [ ] **Empty state** when user has no parties: illustration + "You haven't joined a Fellowship yet" message with prominent "Create" and "Join" CTAs
- [ ] **"Create Fellowship" button** opens a create party form: name (required, max 50 chars, with character counter and inline validation), distance_mode selector (user-friendly labels: "Only distance walked after joining" / "All distance walked, all time"), leave_distance_behavior selector (user-friendly labels: "Keep their contributed distance" / "Remove their contributed distance")
- [ ] **"Join Fellowship" section** with invite code input (shows preview before confirming, including party settings). Error states: invalid code, dissolved party, already a member, network error
- [ ] Clicking a party navigates to the Fellowship detail page (`/party/:id`)
- [ ] **Party list updates** when a new party is created or joined
- [ ] **Dissolved parties** shown in a collapsed "Past Fellowships" section at the bottom (read-only, muted visual style, showing name, dissolution date, and final distance reached)
- [ ] **Loading skeleton** while party list is being fetched

**Page 2: Fellowship Detail (`/party/:id`)**
- [ ] **Back navigation**: header shows `← Fellowships / [Party Name]` with clickable back link to `/party`
- [ ] Shows **party name** and basic info (distance_mode, leave_distance_behavior displayed in user-friendly labels)
- [ ] Displays **total party progress** (combined distance) and **distance to next milestone**
- [ ] Shows **last milestone crossed** by the party (name and distance)
- [ ] **Member list** showing: name, contribution, joined date, status (active/left/kicked), **color** (matching Map segment color). Active member count displayed prominently.
- [ ] Contribution display based on party's configured distance mode
- [ ] **Activity feed** (last 10 activities via `GET /api/party/:id/activity`, per Story 3.8 — displayed inline on this page)
- [ ] Member actions: **Leave party button** with confirmation dialog showing: party name, user's contributed distance, impact statement based on leave_distance_behavior ("Your XX.X km will remain in the party total" / "⚠️ Your XX.X km will be removed from the party total"), and if leader: "⚠️ Leadership will transfer to [oldest active member]" or "This party will be dissolved" if sole member
- [ ] If user is party leader: show **"Manage Fellowship" button** navigating to `/party/:id/manage`
- [ ] **Invite link sharing:** Display the full invite URL (format: `{origin}/party/join/{inviteCode}`) with a **"Copy Link" button** that copies the full URL to clipboard. Additionally, show a **"Share" button** that uses the Web Share API (navigator.share) on supported devices (mobile PWA) to share the invite link with a pre-filled message ("Join my Fellowship on Walk to Mordor!"). Fallback to copy-only on unsupported devices. The raw invite code should also be visible for manual entry.
- [ ] **Loading skeleton** while data is being fetched
- [ ] **Error handling**: if API returns 403 (kicked/departed), show "You are no longer a member of this Fellowship" with button to return to Fellowships list. If 404, show "This Fellowship no longer exists."
- [ ] **Graceful handling** when party is dissolved or user is kicked while viewing (on next API call/refresh, show appropriate message)

**Page 3: Fellowship Management (`/party/:id/manage`, leader only)**
- [ ] **Back navigation**: header shows `← [Party Name] / Manage` with clickable back link to `/party/:id`
- [ ] Redirect to `/party/:id` if user is not the party leader (with toast message)
- [ ] **Update party settings:** distance_mode selector, leave_distance_behavior selector (via `PUT /api/party/:id/settings`), with user-friendly labels and confirmation on distance_mode changes ("Changing distance mode will recalculate all member contributions. Continue?")
- [ ] **Kick member** controls with two-step confirmation: click "Kick" → confirmation dialog showing member name, their contributed distance, party default behavior, and toggle to override ("Remove [Name]'s XX.X km from party total?") → destructive confirm button (red styling)
- [ ] **Transfer leadership** to another active member (via `POST /api/party/:id/transfer-leadership`) with confirmation dialog: "Transfer leadership to [Name]? You will become a regular member and lose management access." After transfer: redirect to `/party/:id` (user loses manage access)
- [ ] **Regenerate invite code** button with confirmation ("Previous invite code will stop working. Continue?")
- [ ] **Loading states** for all management actions

**Join Landing Page (`/party/join/:inviteCode`)**
- [ ] Create `/party/join/:inviteCode` route with SSR shell (new `renderPartyJoinPage.ts` following `renderLayout()` pattern) and a Preact island
- [ ] **Authenticated users:** Show party preview (name, member count, combined distance, distance_mode, leave_distance_behavior in user-friendly labels) via `GET /api/party/join/:inviteCode`. Display a **"Join Fellowship" button** that calls `POST /api/party/join/:inviteCode`. On success, redirect to `/party/:id` (the newly joined party's detail page).
- [ ] **Non-authenticated users:** Show the same party preview (name, member count — using the public preview endpoint). Display a **"Log in to Join"** button that redirects to the login page with `returnTo=/party/join/:inviteCode` so the user returns to the join page after authentication. After login redirect, the page loads with the authenticated join flow.
- [ ] **Error states:** Invalid invite code → "This invite link is invalid or has expired" with link to `/party`. Dissolved party → "This Fellowship no longer exists." Already a member → "You're already a member of this Fellowship!" with link to `/party/:id`. Network error → retry prompt.
- [ ] **Post-join redirect:** After successful join, navigate to `/party/:id` for the joined party.
- [ ] **Loading skeleton** while preview is being fetched

**Cross-cutting:**
- [ ] All new interactive elements follow existing accessibility patterns (ARIA labels, focus management, keyboard navigation, WCAG AA contrast)
- [ ] All fellowship pages must be functional and usable on screens ≥320px wide (mobile-first, matching existing PWA patterns)
- [ ] Use `history.pushState` for navigation between pages so browser back button works

**FRs:** FR_PARTY_01, FR_PARTY_02, FR_PARTY_03, FR_PARTY_05, FR_PARTY_06, FR_PARTY_07, FR_PARTY_08, FR_PARTY_10, FR_PARTY_11, FR_PARTY_12

**Dependencies:** Story 3.6

**change-impact:** Restructured from single-page to 3-page flow (list → detail → management) plus a join landing page for deep-link invite URLs. Fellowship detail page now shows total progress, last milestone crossed, member contributions, and activity feed. Management page is leader-only with confirmation dialogs for destructive actions. Added navigation link to DrawerIsland. Back-navigation pattern established for hierarchical pages. SSR + Preact island rendering pattern specified. Error handling and loading states defined. **Added:** `/party/join/:inviteCode` deep-link landing page for clickable invite links (FR_PARTY_03). Invite sharing expanded with full URL, Copy Link, and Web Share API. Non-authenticated user flow for invite deep-links with login redirect. FR_PARTY_03 added to story coverage. Future: User custom map icon (FR_PARTY_13) and Fellowship profile icon (FR_PARTY_14) are follow-up items not in this story.

---

#### Story 3.8: Fellowship Progress Activity Feed (Issue #176)

**Priority:** P2

**Description:** Show recent activity from Fellowship members as a feed on the Fellowship detail page (`/party/:id`). Scoped per-party since users can belong to multiple parties.

**Acceptance Criteria:**
- [ ] Display last 10 party member activities on the **Fellowship detail page** (`/party/:id`) using `GET /api/party/:id/activity` (from Story 3.4)
- [ ] Format: "[Member] walked [X] km on [Date]"
- [ ] Auto-refresh every 60 seconds (or on page focus)
- [ ] Distinguish own activities from others
- [ ] Show "No recent activity" placeholder when empty
- [ ] Privacy: Only show to active party members

**FRs:** FR_PARTY_05

**Dependencies:** Story 3.4, Story 3.7

**change-impact:** Activity feed now lives on the Fellowship detail page (`/party/:id`) instead of a generic "currently selected party" context. Depends on Story 3.4 for the `GET /api/party/:id/activity` endpoint and walk-logging → `party_progress_log` integration. Still scoped per-party.

---

#### Story 3.9: Fellowship Notifications - Party Milestones (Issue #177)

**Priority:** P3

**Description:** Proactive notifications when the Fellowship reaches a new milestone together. The party-switch milestone modal is implemented in Story 3.6; this story covers server-side notifications (toast/email) and detection logic.

**Acceptance Criteria:**
- [ ] Detect when party progress crosses a milestone threshold (server-side, on walk log)
- [ ] In-app notification/toast for all members on next page load (distinct from the party-switch modal in Story 3.6)
- [ ] **Note:** The party-switch milestone modal (showing the milestone on view switch) is owned by Story 3.6 via `last_viewed_distance` tracking. This story does NOT duplicate that modal — it adds proactive push-style notifications.
- [ ] Optional: Email notification (digest-style, not per-milestone)
- [ ] Notification shows: "Your Fellowship reached [Milestone Name]!"
- [ ] One-time notification per milestone per user (don't repeat)

**FRs:** FR_PARTY_04, FR_PARTY_09, FR_LORE_01

**Dependencies:** Story 3.4, Story 1.2

**change-impact:** Added party view switch milestone modal requirement (FR_PARTY_09). The `last_viewed_distance` tracking mechanism (from Story 3.1/3.4) enables this.

---

#### Story 3.10: Fellowship Privacy & Authorization (Issue #178)

**Status:** Deprecated / Merged into Stories 3.2, 3.3, 3.4, 3.5

**Requirements Distributed:**
- All party endpoints validate user membership -> Distributed to individual API stories
- Party data only visible to members -> Distributed to Story 3.4
- Invite code is only secret -> Distributed to Story 3.2
- User's individual progress remains private -> Distributed to Story 3.4
- Party progress is opt-in -> Distributed to Story 3.3
- IDOR prevention -> Distributed to all API stories
- Party settings (distance_mode, leave_distance_behavior) controlled by leader only -> Distributed to Stories 3.2, 3.5, 3.7
- Kick authorization (leader only) -> Distributed to Story 3.5
- Leadership transfer authorization (leader only) -> Distributed to Story 3.5
- Party settings update authorization (leader only) -> Distributed to Story 3.5

---

### Epic 4: Admin Portal (Issue #153)

#### Story 4.1: Admin Authentication & Authorization (Issue #179)

**Priority:** P0 (Blocker)

**Description:** Secure admin access with role-based authentication.

**Acceptance Criteria:**
- [ ] Add `is_admin` boolean column to users table
- [ ] Create admin middleware to check admin status on protected routes
- [ ] Admin routes return 403 if user is not admin
- [ ] Log admin actions for audit trail
- [ ] Initial admin user seeded via migration or manual DB update
- [ ] Admin status not self-assignable (requires DB access)

**Dependencies:** None

---

#### Story 4.2: Admin Dashboard Shell (Issue #180)

**Priority:** P1

**Description:** Create the admin portal landing page with navigation and basic stats.

**Acceptance Criteria:**
- [ ] Create `/admin` route (protected)
- [ ] Dashboard shows: total users, total distance logged, active parties count
- [ ] Navigation menu: Goals, Users (future), Metrics
- [ ] Consistent styling with main app (dark theme)
- [ ] Breadcrumb navigation back to main site

**Dependencies:** Story 4.1

---

#### Story 4.3: Goal Management - List View (Issue #181)

**Priority:** P1

**Description:** Admin interface to view and browse all goals/milestones.

**Acceptance Criteria:**
- [ ] Create `/admin/goals` route
- [ ] Paginated list of all 171+ goals
- [ ] Display: ID, name, distance, sort_order, has_image (boolean indicator)
- [ ] Search/filter by name
- [ ] Sort by distance or sort_order
- [ ] Click row to view/edit goal details

**Dependencies:** Story 4.2

---

#### Story 4.4: Goal Management - Edit Goal (Issue #182)

**Priority:** P1

**Description:** Admin form to edit individual goal details and descriptions.

**Acceptance Criteria:**
- [ ] Create `/admin/goals/:id` route
- [ ] Form fields: name, distance, description, sort_order, image_url
- [ ] Description field: Multi-line textarea with Markdown preview support
- [ ] Save changes via API (PUT `/api/admin/goals/:id`)
- [ ] Validation: Required fields, distance must be positive
- [ ] Show success/error feedback
- [ ] Back button to list view

**Technical Notes:**
- Per user feedback: No rich text editor (Markdown textarea is sufficient)
- Image hosting via R2 (see Story 4.5)

**FRs:** FR_ADM_01

**Dependencies:** Story 4.3

---

#### Story 4.5: Goal Management - Image Upload to R2 (Issue #183)

**Priority:** P2

**Description:** Admin interface to upload milestone images directly to Cloudflare R2.

**Acceptance Criteria:**
- [ ] Configure R2 bucket binding in wrangler.json
- [ ] Create `/api/admin/goals/:id/image` POST endpoint for upload
- [ ] Accept image file upload (max 25MB per NFR_CONST_01)
- [ ] Store in R2 with path: `goals/{goal_id}/{filename}`
- [ ] Run image through optimization (WebP conversion, resize)
- [ ] Update goal's image_url with R2 public URL
- [ ] Show upload progress indicator
- [ ] Preview current and new image before save

**Technical Notes:**
- Per user feedback: Images hosted on R2, not local filesystem
- Use Workers R2 binding for direct upload

**NFRs:** NFR_CONST_01

**Dependencies:** Story 4.4

---

#### Story 4.6: Goal Management - Add Intermediary Goal (Issue #184)

**Priority:** P2

**Description:** Admin form to add new intermediary goals between existing milestones.

**Acceptance Criteria:**
- [ ] "Add New Goal" button on goals list page
- [ ] Form: name, distance, description, sort_order, image
- [ ] Auto-suggest sort_order based on distance (between neighbors)
- [ ] Validation: Distance must be unique or warn if duplicate
- [ ] Preview where goal will appear in sequence
- [ ] Save creates new goal record
- [ ] Existing user progress unaffected (only future calculations include new goal)

**FRs:** FR_ADM_02

**Dependencies:** Story 4.4

---

### Epic 5: Races (Competitive Events)

#### Story 5.1: Race Database Schema (Issue #185)

**Priority:** P0 (Blocker)

**Description:** Create database tables for time-limited race events.

**Acceptance Criteria:**
- [ ] Create `races` table: id, name, description, start_date, end_date, created_by, created_at, status (upcoming/active/completed)
- [ ] Create `race_participants` table: id, race_id, user_id, joined_at, distance_at_start (baseline)
- [ ] Add indexes for active race queries
- [ ] Create migration file
- [ ] Document schema in `docs/data-models.md`

**Technical Notes:**
- `distance_at_start` captures user's total distance when they join, so race progress = current total - distance_at_start

**Dependencies:** None

---

#### Story 5.2: Race Management API (Admin) (Issue #186)

**Priority:** P1

**Description:** Admin API endpoints for creating and managing races.

**Acceptance Criteria:**
- [ ] POST `/api/admin/races` - Create new race (name, description, start_date, end_date)
- [ ] PUT `/api/admin/races/:id` - Update race details
- [ ] DELETE `/api/admin/races/:id` - Cancel/delete race (only if not started)
- [ ] GET `/api/admin/races` - List all races with participant counts
- [ ] Validation: end_date > start_date, dates in future for new races
- [ ] Only admins can access these endpoints

**Dependencies:** Story 5.1, Story 4.1

---

#### Story 5.3: Race Join & Leave API (Issue #187)

**Priority:** P1

**Description:** API endpoints for users to join and leave races.

**Acceptance Criteria:**
- [ ] GET `/api/races` - List upcoming and active races
- [ ] GET `/api/races/:id` - Get race details and current standings
- [ ] POST `/api/races/:id/join` - Join race (record distance_at_start)
- [ ] POST `/api/races/:id/leave` - Leave race (before it ends)
- [ ] Validation: Can only join before race ends
- [ ] Validation: Cannot join same race twice
- [ ] Return 404 for invalid race IDs

**Dependencies:** Story 5.1

---

#### Story 5.4: Race Leaderboard API (Issue #188)

**Priority:** P1

**Description:** API endpoint for race standings and leaderboard.

**Acceptance Criteria:**
- [ ] GET `/api/races/:id/leaderboard` - Get ranked participant list
- [ ] Calculate race progress: participant's current total - distance_at_start
- [ ] Return: rank, user display name, race_distance, last_activity_date
- [ ] Sort by race_distance descending
- [ ] Indicate current user's position
- [ ] Cache leaderboard for 5 minutes

**Dependencies:** Story 5.3

---

#### Story 5.5: Race UI - Discovery & Join (Issue #189)

**Priority:** P2

**Description:** User interface to browse and join available races.

**Acceptance Criteria:**
- [ ] Create `/races` route
- [ ] List upcoming and active races with: name, dates, participant count
- [ ] Race card shows: time remaining (countdown for active)
- [ ] "Join Race" button for races user hasn't joined
- [ ] "View Standings" button for joined races
- [ ] Filter: Upcoming / Active / Past tabs

**Dependencies:** Story 5.3

---

#### Story 5.6: Race UI - Leaderboard & Progress (Issue #190)

**Priority:** P2

**Description:** User interface to view race standings and personal progress.

**Acceptance Criteria:**
- [ ] Create `/races/:id` route
- [ ] Show race details: name, description, date range, status
- [ ] Display leaderboard table: rank, name, distance, trend (up/down)
- [ ] Highlight current user's row
- [ ] Show user's race progress: "You've walked X km in this race"
- [ ] Progress bar toward a race goal (if defined)
- [ ] Auto-refresh leaderboard every 60 seconds
- [ ] Post-race: Show final standings, winner highlight

**Dependencies:** Story 5.5

---

## Summary

| Epic | Issue # | Stories | Priority Range |
|------|---------|---------|----------------|
| Epic 1: Phase 1 Polish | #150 | 9 | P0-P3 |
| Epic 2: Interactive Map | #151 | 8 | P1-P2 |
| Epic 3: Fellowship | #152 | 10 | P0-P3 |
| Epic 4: Admin Portal | #153 | 6 | P0-P2 |
| Epic 5: Races | #154 | 6 | P0-P2 |
| **Total** | | **39** | |

### Recommended Implementation Order

1. **Epic 1** (#150) - Stories 1.1-1.2 first as blockers, then remaining
2. **Epic 2** (#151) - After Preact infrastructure
3. **Epic 3** (#152) - Core Fellowship features
4. **Epic 5** (#154) - Races, leverages Fellowship patterns
5. **Epic 4** (#153) - Admin portal, can be parallelized with Epic 3

