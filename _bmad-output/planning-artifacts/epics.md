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
| FR_PARTY_14 | Epic 6 | Invite friends to Fellowship (acceptance required) |
| FR_PARTY_15 | Epic 6 | Pending fellowship invite badge on nav |
| FR_PARTY_16 | Epic 6 | Accept/reject fellowship invites from list |
| FR_PARTY_17 | Epic 6 | Add Friend shortcut on Fellowship member list |
| FR_FRIEND_01 | Epic 6 | Send friend request via username search |
| FR_FRIEND_02 | Epic 6 | Share personal friend link |
| FR_FRIEND_03 | Epic 6 | Accept/reject friend requests |
| FR_FRIEND_04 | Epic 6 | Remove friend (mutual unfriend) |
| FR_FRIEND_05 | Epic 6 | Friends list with username, avatar, last progressed |
| FR_FRIEND_06 | Epic 6 | Friend profile page (distance, shared fellowships) |
| FR_FRIEND_07 | Epic 6 | Select predefined LOTR-themed avatar |
| FR_FRIEND_08 | Epic 6 | Pending friend request badge on nav |
| FR_FRIEND_09 | Epic 6 | Toggle Show Friends on Map |
| FR_FRIEND_10 | Epic 6 | Tap friend map avatar for mini-card |

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
- Party settings: distance mode (cumulative/incremental) set at creation (immutable), leave-distance behavior (keep/remove) and party name updatable after creation
- Party selector on Journey and Map pages (hidden if user has no parties)
- Per-member color-coded contribution segments on Map view
- Party milestone modal triggered on view switch (when party has passed a new milestone since last viewed)
- Shared progress tracking with leader-configured calculation mode
- Leadership transfer without leaving
- Auto-dissolution of empty parties
- Invite code rotation (leader can manually regenerate; previous code is immediately invalidated)
- Re-join support (reactivate existing membership record with a fresh join baseline)
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

**Alignment Notes (2026-03-06):**
- Keep existing asset strategy: optimized WebP files in `public/img/highres/` and `public/img/thumbs/`, referenced by `goals.image_id`.
- Do not introduce R2 for Epic 4.
- Admin goal management must align with current schema (`title`, `distance`, `description`, `special`, `image_id`) and distance-based ordering (no `sort_order`).

**Status:** Future enhancement, after Fellowship

---

### Epic 5: Races (Competitive Events) (Issue #154)

**Goal:** Time-limited competitive events where users can join races and compete for progress within a specific timeframe.

**FRs Covered:** Race feature set from Issue #139

**Tech:** New `races` table with start_date, end_date, and leaderboard tracking

**Alignment Notes (2026-03-09):**
- Stories 5.1, 5.3–5.6 should leverage the Friends layer (Epic 6) for discovery, privacy, and identity once available.
- Entrant model decision can reference friendships for "invite friends to race" flow.
- Race leaderboard identity uses `username` + `avatar_id` from the avatar system (Epic 6, Story 6.1).
- Privacy/visibility rules for race discovery and standings should build on the friend relationship model.
- See [Epic 5 Architecture Alignment Review](../implementation-artifacts/epic-5-architecture-alignment-2026-03-09.md) for the full gap analysis.

**Status:** New feature, requires Epic 6 (Friends) alignment before story execution

---

### Epic 6: Friends & Social Identity

**Goal:** Mutual friend relationships, predefined LOTR-themed avatars, friend-based fellowship invitations, and friend visibility on the Map — providing a relational/social layer that simplifies Race design.

**FRs Covered:** FR_FRIEND_01–FR_FRIEND_10, FR_PARTY_14–FR_PARTY_17

**Tech:** New `friendships` table, `avatar_id` on users, predefined avatar assets in `public/img/avatars/`, unified Social panel on Map

**Includes:**
- Mutual friend system (send/accept/reject/remove)
- Friend discovery via username search and shareable friend link
- Predefined LOTR-themed avatar gallery (stored in `public/img/avatars/`)
- Friends list page with username, avatar, last progressed date
- Friend profile page showing total distance and fellowships (highlighting shared ones)
- Fellowship invite via friends (acceptance required, badge on Fellowships nav, accept/reject from list)
- Add Friend shortcut on Fellowship member list
- Unified Social panel on Map (fellowship selector + "Show Friends" toggle)
- Friend avatars rendered at journey positions on Map, tappable for mini-card
- Pending request badges on Friends and Fellowships nav links

**Status:** New feature, can be implemented independently of Epic 5

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
- [ ] Create `party_members` table: id, party_id, user_id, joined_at, **distance_at_join** (DECIMAL), role (leader/member), status (active/left/**kicked**), **last_viewed_distance** (DECIMAL, default 0), **departed_at** (DATETIME, default NULL), **distance_kept** (BOOLEAN, default NULL — set on departure to record whether the member's contribution was kept or removed, capturing any kick override), **contribution_at_departure** (DECIMAL, default NULL — locked snapshot of contribution at leave/kick time)
- [ ] Create `party_progress_log` table: id, party_id, logged_by_user_id, distance, **date** (DATE — correlates with the progress table entry), logged_at (for activity feed and contribution audit trail)
- [ ] Add indexes for common queries (party lookups, member listings, multi-party user lookups)
- [ ] Create migration file in `migrations/` folder
- [ ] Document schema in `docs/data-models.md`

**FRs:** FR_PARTY_01, FR_PARTY_04, FR_PARTY_06, FR_PARTY_07, FR_PARTY_09, FR_PARTY_12, ADR-004

**Technical Notes:**
- `distance_at_join` stores the user's total distance at the moment they join, enabling both "cumulative" and "incremental" progress modes.
- `distance_mode` on `parties` determines how party progress is calculated: 'cumulative' (all-time totals) or 'incremental' (distance since joining). Set by the leader at party creation and immutable after creation.
- `leave_distance_behavior` on `parties` determines what happens to a member's contributed distance when they leave: 'keep' (distance remains) or 'remove' (distance is subtracted). Set by the leader at party creation, updatable via settings API.
- `last_viewed_distance` on `party_members` tracks the party's total distance as of the user's last view of that party, enabling milestone modal display when switching between party views.
- `departed_at` on `party_members` records when a member left or was kicked.
- `distance_kept` on `party_members` (BOOLEAN, default NULL) — set on departure to record whether the member's contributed distance was kept (`true`) or removed (`false`) from the party total. This captures any kick-specific distance override (Story 3.5) so that later progress calculations don't lose the disposition decision. NULL for active members.
- `contribution_at_departure` on `party_members` stores a locked contribution snapshot computed at leave/kick time (based on party `distance_mode`) so departed contributions do not require perpetual date-range recalculation. This snapshot-based model is the authoritative design for departed-member contributions and **supersedes** the earlier ADR-004 / sprint change proposal behavior that derived departed contributions from `distance_at_join` + `departed_at` via the `progress` table; those older references MUST be treated as obsolete and updated to match this snapshot approach.
- `dissolved_at` on `parties` is set when a party is auto-dissolved (all members departed). Dissolved parties cannot be re-joined.
- `status` supports 'kicked' to distinguish leader-initiated removals from voluntary leaves.
- **Re-join:** When a user re-joins a party they previously left/were kicked from, **do not create a new `party_members` row**. Instead, reactivate the existing `party_members` record (set status back to active, refresh `joined_at` and `distance_at_join`, clear departure fields). Enforce a single membership row per `(party_id, user_id)`; membership and contribution history come from departure fields and `party_progress_log`, not from multiple membership rows.
- Index on `party_members(user_id)` is important for efficiently querying all parties a user belongs to (multi-party membership).
- `party_progress_log` has a `date` column (DATE) correlating with the `progress` table, enabling accurate updates when walks are edited or deleted.

**Dependencies:** None

**change-impact:** Requirements expanded — `departed_at`, `distance_kept`, and `contribution_at_departure` added to `party_members`; `dissolved_at` added to `parties`. Re-join reactivates existing membership records (single row per `(party_id, user_id)`); new `party_members` rows are never created on re-join. `party_progress_log` serves as the contribution audit trail and source of historical membership behavior. All downstream stories (3.2–3.8) must reference the updated schema and re-join semantics.

---

#### Story 3.2: Create Fellowship API (Issue #170)

**Priority:** P1

**Description:** API endpoint for creating a new Fellowship with the current user as leader, including party settings configuration.

**Acceptance Criteria:**
- [ ] POST `/api/party` - Create new party
- [ ] Request body: { name: string, **distance_mode?: 'cumulative' | 'incremental'**, **leave_distance_behavior?: 'keep' | 'remove'** }
- [ ] `distance_mode` defaults to 'incremental' if not provided
- [ ] `distance_mode` is immutable after creation (cannot be changed by settings API)
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
- [ ] **Re-join:** If user previously left/was kicked from the party, reactivate the existing `party_members` record and reset join baseline (`joined_at`, `distance_at_join`, `last_viewed_distance`, departure fields). Return 400 if party is dissolved.
- [ ] POST `/api/party/:id/invite` - Generate new invite code (leader only). Previous invite code is immediately invalidated. Response includes the new invite code **and** the full shareable invite URL (format: `{request.origin}/party/join/{inviteCode}`)
- [ ] **GET `/api/user/parties`** - Return list of all parties the user is an active member of (id, name, role, distance_mode, leave_distance_behavior, active_member_count). Exclude dissolved parties by default. Accept optional `?include_dissolved=true` query parameter to also return dissolved parties (with `dissolved_at` field) for the Fellowships list page history section (Story 3.7).
- [ ] Validate: Cannot join the same party twice (no duplicate active memberships)
- [ ] **Allow joining multiple different parties** — no single-party restriction
- [ ] Return 404 for invalid invite codes
- [ ] **Security:** Verify implicit opt-in (joining is the consent action)
- [ ] **Security:** Validate Invite Code integrity (prevent enumeration/brute-force)

**FRs:** FR_PARTY_01, FR_PARTY_02, FR_PARTY_03, FR_PARTY_08

**Dependencies:** Story 3.2

**change-impact:** Added `GET /api/user/parties` endpoint. Re-join now reactivates existing membership record (not creating duplicates). `departed_at` initialized to NULL on join/reactivation. Dissolved party check on join. Invite regeneration explicitly invalidates prior codes.

---

#### Story 3.4: Fellowship Progress Calculation API (Issue #172)

**Priority:** P1

**Description:** API endpoint to calculate and return combined Fellowship progress using the party's configured distance mode.

**Acceptance Criteria:**
- [ ] GET `/api/party/:id/progress` - Get party progress
- [ ] **Distance mode is read from the party's `distance_mode` setting** (not a query param) — leader configures this at creation
- [ ] **Cumulative Mode:** Sum of all active members' total distances (all-time)
- [ ] **Incremental Mode:** Sum of (member total distance - distance_at_join) for each active member (only counts progress since joining)
- [ ] **Handle left/kicked members based on `distance_kept` and locked snapshots:** if `distance_kept = true`, include departed members' stored `contribution_at_departure`; if `distance_kept = false`, exclude them.
- [ ] Return: total_distance, member_count, calculated_position (milestone), distance_mode, leave_distance_behavior
- [ ] Include breakdown by member: { user_id, display_name, contribution, status, **color** }
- [ ] For incremental mode, active member `contribution` = current total - distance_at_join
- [ ] For departed members: use `contribution_at_departure` computed and stored at leave/kick time; do not recalculate historical date ranges during progress reads
- [ ] For kicked members with distance override (`distance_kept = false`): exclude that member's contribution entirely regardless of party default
- [ ] For re-joined members (single membership row): contribution is based on current active baseline after reactivation (no multi-row aggregation required)
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
- `contribution_at_departure` is calculated once at leave/kick time (using the party's immutable `distance_mode`) and stored on `party_members`. Progress reads use this locked value for departed members to avoid repeated historical recalculation.
- For re-joined members: one `party_members` row per user+party is reactivated with refreshed join baseline; no multi-record aggregation logic is needed.
- `last_viewed_distance` update enables FR_PARTY_09 (milestone modal on party view switch, owned by Story 3.6).
- Member `color` is computed deterministically from `user_id % palette_size` for stability across sessions and re-joins.
- **Walk logging integration (cross-cutting, owned by this story):** When a walk is logged via `POST /api/calendar-progress`, insert a `party_progress_log` entry (with `date` column) for each of the user's active parties. On `PUT /api/calendar-progress`, update corresponding entries. On `DELETE /api/calendar-progress`, remove corresponding entries. This is the only Epic 3 change to existing code.
- **`GET /api/party/:id/activity`** endpoint returns the last N entries from `party_progress_log` for the activity feed on the detail page (Story 3.8).
- **Parameterized routing:** The Worker router in `src/index.ts` uses exact string matching. Story 3.2 (first party API story) should add parameterized route matching as a prerequisite for all subsequent party endpoints.

**Dependencies:** Story 3.3

**change-impact:** Departed member contributions now use locked `contribution_at_departure` snapshots (computed at leave/kick), eliminating perpetual date-range calculations in the progress hot path. Re-join complexity reduced by using one membership row per user+party. Walk logging → party_progress_log integration remains explicit. Activity feed API endpoint retained. Member color assignment remains deterministic by `user_id`.

---

#### Story 3.5: Leave, Kick & Party Management API (Issue #173)

**Priority:** P1

**Description:** API endpoints for members to leave a Fellowship, for leaders to kick members, update party settings, transfer leadership, and handle party dissolution.

**Acceptance Criteria:**
- [ ] POST `/api/party/:id/leave` - Leave party
- [ ] Set member status to 'left', **`departed_at` = current timestamp**, and **`distance_kept`** based on the party's `leave_distance_behavior` setting (soft delete, preserve history)
- [ ] On leave, compute and store **`contribution_at_departure`** once (based on party `distance_mode`) for future progress reads
- [ ] **Apply party's `leave_distance_behavior` setting:** If 'keep', set `distance_kept = true`. If 'remove', set `distance_kept = false`.
- [ ] If leader leaves: transfer leadership to oldest active member, or dissolve if no active members remain
- [ ] **Auto-dissolve:** If no active members remain after departure, set `parties.dissolved_at` = current timestamp (soft-delete the party). Use a D1 batch transaction to prevent race conditions with concurrent departures.
- [ ] Return success confirmation
- [ ] Validate: User must be active member of party (IDOR Check)
- [ ] POST `/api/party/:id/kick/:userId` - **Kick a member (leader only)**
- [ ] Set kicked member's status to 'kicked' and **`departed_at` = current timestamp**
- [ ] On kick, compute and store **`contribution_at_departure`** once (based on party `distance_mode`) before applying keep/remove disposition
- [ ] **Accept optional `removeDistance` boolean** in request body to override the party's `leave_distance_behavior` setting (e.g., leader can force-remove a cheater's distance even if the default is 'keep')
- [ ] If `removeDistance` is not provided, fall back to the party's `leave_distance_behavior` setting
- [ ] **Set `distance_kept`** on the kicked member's record: `true` if distance is being kept, `false` if removed. This preserves the disposition decision for future progress calculations.
- [ ] Return 403 if non-leader attempts to kick
- [ ] Return 400 if leader tries to kick themselves (must use leave instead)
- [ ] **Auto-dissolve:** Check if no active members remain after kick. If so, set `parties.dissolved_at`.
- [ ] **PUT `/api/party/:id/settings`** - Update party settings (leader only)
- [ ] Accept JSON body with optional `{ name?: string, leave_distance_behavior?: 'keep' | 'remove' }`
- [ ] `distance_mode` is immutable after creation and cannot be updated via settings API
- [ ] Validate values. Return 403 if non-leader. Return 404 if party not found or dissolved.
- [ ] **POST `/api/party/:id/transfer-leadership`** - Transfer leadership to another active member (leader only)
- [ ] Accept JSON body with `{ new_leader_id: number }`
- [ ] Validate new_leader_id is an active member of the party
- [ ] Update old leader's role to 'member', new leader's role to 'leader', update `parties.leader_id`
- [ ] Return 403 if non-leader. Return 400 if target is not an active member.

**FRs:** FR_PARTY_06, FR_PARTY_07, FR_PARTY_10, FR_PARTY_11, FR_PARTY_12

**Dependencies:** Story 3.3

**change-impact:** Added settings update API (FR_PARTY_10), leadership transfer (FR_PARTY_11), auto-dissolution (FR_PARTY_12). `departed_at`, `distance_kept`, and `contribution_at_departure` are set on leave/kick. Party settings updates now support rename + leave behavior only; `distance_mode` is immutable.

---

#### Story 3.6: Fellowship UI - Journey & Map Party Selector (Issue #174)

**Priority:** P1

**Description:** Add a party selector to the Journey and Map pages allowing users to toggle between personal distance and any of their parties' combined distance. Hidden if user has no parties.

**Acceptance Criteria:**
- [ ] Use `GET /api/user/parties` (from Story 3.3) to fetch the user's active party list
- [ ] **Party selector** implemented as a new Preact island (`PartySelector`) mounted above the main content area on both Journey and Map pages
- [ ] If user is a member of at least one party: Show a selector/dropdown on **Journey page** to choose between "Personal" and each party name
- [ ] If user is a member of at least one party: On the **Map page**, use a button that opens the fellowship selector similar to how there is a button to open the calendar area
- [ ] **Selector is hidden** if user is not a member of any party
- [ ] When a party is selected, display a visual indicator banner (e.g., "👥 Viewing: [Fellowship Name]") to distinguish from personal view
- [ ] When a party is selected on **Journey page**: Display the party's combined distance and milestone progress instead of personal (NextGoalCard and UpcomingGoalCard re-render with party progress). Show brief loading indicator during data fetch.
- [ ] When a party is selected on **Map page**: Display the party's combined distance path, showing **per-member contributed segments with color-coded lines** (each member assigned a distinct color computed deterministically from `user_id % palette_size` for stability across sessions and re-joins). Include a map legend showing member name + color swatch when in party view. Goals on the map should be locked/unlocked based on the viewed fellowship's total distance and the individual user's lock/unlock preference.
- [ ] **Color palette:** Define a 12-color maximum distinctness palette. For members beyond 12, just repeat the colors (they will be spread out enough). Departed members whose contributions are kept: show in muted/desaturated version of their color. Departed with removed contributions: don't show.
- [ ] When switching to a party view: Call GET `/api/party/:id/progress` and check `newly_passed_milestones` — if any exist, display the **milestone modal for the latest passed milestone** (FR_PARTY_09). This is the primary owner of the party-switch milestone modal behavior.
- [ ] **Do not re-trigger** milestone modal when simply toggling between parties at different positions — only trigger when the party has progressed past a new milestone since the user's last view. The `last_viewed_distance` is updated on each progress API call, ensuring the modal fires at most once per milestone per party per user.
- [ ] Persist the user's last selected view (personal/party) in localStorage for page reload continuity. **Edge case:** If persisted party ID returns 403/404 from API (user kicked, party dissolved), fall back to "Personal" view silently and clear the stale localStorage value.

**FRs:** FR_PARTY_04, FR_PARTY_05, FR_PARTY_08, FR_PARTY_09

**Dependencies:** Story 3.4, Story 1.1

**change-impact:** This story replaces the original "Dashboard Integration" scope. Now covers multi-party selection on Journey/Map pages, per-member **color-coded** map segments (deterministic colors from user ID), and party milestone modal triggering (FR_PARTY_09 primary implementation), plus map legend, loading states, stale localStorage handling. Uses `GET /api/user/parties` from Story 3.3. Significantly expanded from original spec.

---

#### Story 3.7: Fellowship UI - Fellowships Pages (Issue #175)

**Priority:** P2

**Description:** Fellowship UI flow with four routes: three pages accessible from the navigation drawer (list → detail → management), plus a join landing page for deep-link invite URLs. The flow is: nav drawer → Fellowships list (select or create) → Fellowship detail (members, contributions, progress, milestone) → Fellowship management (leader only). Additionally, `/party/join/:inviteCode` serves as a deep-link landing page when users click a shared invite link. Each route renders via SSR (following `renderLayout()` pattern) with a corresponding Preact island.

**Acceptance Criteria:**

**Page 1: Fellowships List (`/party`)**
- [ ] Create `/party` route (titled "Fellowships") with SSR shell (new `renderPartyListPage.ts` following `renderLayout()` pattern) and a Preact island
- [ ] **Add "Fellowships" link to the DrawerIsland navigation** (alongside Journey and Map links)
- [ ] Page shows a **list of all parties** the user belongs to (via `GET /api/user/parties` from Story 3.3), each showing party name and **active member count**
- [ ] **Always show "Create Fellowship" and "Join Fellowship" buttons/sections**, regardless of whether the user is in a party or not
- [ ] **Empty state** when user has no parties: illustration + "You haven't joined a Fellowship yet" message
- [ ] **"Create Fellowship" button** opens a create party form: name (required, max 50 chars, with character counter and inline validation), distance_mode selector (user-friendly labels: "Only distance walked after joining" / "All distance walked, all time"), leave_distance_behavior selector (user-friendly labels: "Keep their contributed distance" / "Remove their contributed distance")
- [ ] **Distance mode clarity at creation (required):** show plain-language helper text and simple examples next to selector that are sufficiently descriptive so the user has no ambiguity on what the toggles do (e.g., incremental: "Sam joins today; only distance from today counts"; cumulative: "Sam joins today; all prior logged distance counts"). Indicate explicitly that distance mode cannot be changed later.
- [ ] **"Join Fellowship" section** with invite code input (shows preview before confirming, including party settings). Error states: invalid code, dissolved party, already a member, network error
- [ ] Clicking a party navigates to the Fellowship detail page (`/party/:id`)
- [ ] **Party list updates** when a new party is created or joined
- [ ] **Dissolved parties** shown in a collapsed "Past Fellowships" section at the bottom (read-only, muted visual style, showing name, dissolution date, and final distance reached)
- [ ] **Loading skeleton** while party list is being fetched

**Page 2: Fellowship Detail (`/party/:id`)**
- [ ] **Back navigation**: header shows `← Fellowships / [Party Name]` with clickable back link to `/party`
- [ ] Shows **party name**
- [ ] Displays **total party progress** (combined distance) and **distance to next milestone**. Clicking on the next/last milestone should open their goal modals, with the next one being locked based on the individual user's preference.
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
- [ ] **Update party settings:** party name and leave_distance_behavior (via `PUT /api/party/:id/settings`) with user-friendly labels and validation
- [ ] **Kick member** controls with two-step confirmation: click "Kick" → confirmation dialog showing member name, their contributed distance, party default behavior, and toggle to override ("Remove [Name]'s XX.X km from party total?") → destructive confirm button (red styling)
- [ ] **Transfer leadership** to another active member (via `POST /api/party/:id/transfer-leadership`) with confirmation dialog: "Transfer leadership to [Name]? You will become a regular member and lose management access." After transfer: redirect to `/party/:id` (user loses manage access)
- [ ] **Regenerate invite code** button with confirmation ("Previous invite code will stop working. Continue?")
- [ ] **Loading states** for all management actions

**Join Landing Page (`/party/join/:inviteCode`)**
- [ ] Create `/party/join/:inviteCode` route with SSR shell (new `renderPartyJoinPage.ts` following `renderLayout()` pattern) and a Preact island
- [ ] **Authenticated users:** Show party preview (name, member count, combined distance, distance_mode, leave_distance_behavior in user-friendly labels) via `GET /api/party/join/:inviteCode`. Display a **"Join Fellowship" button** that calls `POST /api/party/join/:inviteCode`. On success, redirect to `/party/:id` (the newly joined party's detail page).
- [ ] **Non-authenticated users:** Show the same party preview (name, member count — using the public preview endpoint). Display a **"Log in to Join"** button that redirects to the login page with `returnTo=/party/join/:inviteCode` so the user returns to the join page after authentication. After login redirect, the page loads with the authenticated join flow.
- [ ] **Error states:** Invalid invite code → "This invite link is invalid" with link to `/party`. Dissolved party → "This Fellowship no longer exists." Already a member → "You're already a member of this Fellowship!" with link to `/party/:id`. Network error → retry prompt.
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

**Epic 4 Alignment Decision (2026-03-06):**
- Continue using repository-backed static assets with Workers Assets binding.
- Keep `goals.image_id` as the canonical image reference for admin workflows.
- Do not introduce R2 in Epic 4.

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
- [ ] Display: ID, title, distance, has_image (boolean indicator derived from `image_id`)
- [ ] Search/filter by title
- [ ] Sort by distance (ascending/descending)
- [ ] Click row to view/edit goal details

**Dependencies:** Story 4.2

---

#### Story 4.4: Goal Management - Edit Goal (Issue #182)

**Priority:** P1

**Description:** Admin form to edit individual goal details and descriptions.

**Acceptance Criteria:**
- [ ] Create `/admin/goals/:id` route
- [ ] Form fields: title, distance, description, special (optional), image_id (slug)
- [ ] Description field: Multi-line textarea with Markdown preview support
- [ ] Save changes via API (PUT `/api/admin/goals/:id`)
- [ ] Validation: Required fields, distance must be positive
- [ ] Validation: `image_id` must match existing optimized asset slug format when provided
- [ ] Show success/error feedback
- [ ] Back button to list view

**Technical Notes:**
- Per user feedback: No rich text editor (Markdown textarea is sufficient)
- Image references remain `image_id` slugs backed by committed assets in `public/img/`

**FRs:** FR_ADM_01

**Dependencies:** Story 4.3

---

#### Story 4.5: Goal Management - Image Asset Workflow Integration (Issue #183)

**Priority:** P2

**Description:** Admin workflow support for preparing and assigning milestone images using the existing repository asset pipeline (no R2).

**Acceptance Criteria:**
- [ ] Expose current image assignment for a goal (`image_id`) and preview existing thumbnail/high-res assets
- [ ] Provide a guided admin workflow for adding/updating assets via documented pipeline: `raw_assets/` + `npm run optimize:images`
- [ ] Validate assigned `image_id` exists in both `public/img/highres/` and `public/img/thumbs/`
- [ ] Add/update goal image assignment via existing admin goal update endpoint (`image_id` field)
- [ ] Provide clear operator feedback when image files are missing, mismatched, or misnamed
- [ ] Document operational steps for admins/developers in docs (including migration/update flow)

**Technical Notes:**
- Per user decision: Continue with static assets in repository + Workers Assets binding
- Reuse existing optimization script and `image_id` slug conventions

**NFRs:** NFR_CONST_01

**Dependencies:** Story 4.4

---

#### Story 4.6: Goal Management - Add Intermediary Goal (Issue #184)

**Priority:** P2

**Description:** Admin form to add new intermediary goals between existing milestones.

**Acceptance Criteria:**
- [ ] "Add New Goal" button on goals list page
- [ ] Form: title, distance, description, special (optional), image_id (optional)
- [ ] Use strict distance-based ordering; no `sort_order` column
- [ ] Validation: Distance must be unique or warn if duplicate
- [ ] Preview where goal will appear in sequence
- [ ] Save creates new goal record
- [ ] Existing user progress unaffected (only future calculations include new goal)
- [ ] Add regression checks for map waypoint rendering and party milestone calculations after insertion

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

### Epic 6: Friends & Social Identity

#### Story 6.1: Friends Database Schema & Avatar System (Issue #TBD)

**Priority:** P0 (Blocker)

**Description:** Create the friendships table, add avatar support to users, and prepare predefined LOTR-themed avatar assets.

**Acceptance Criteria:**
- [ ] Create `friendships` table: id, requester_id (FK → users.id), addressee_id (FK → users.id), status ('pending', 'accepted'), created_at, updated_at
- [ ] Add UNIQUE constraint on `(requester_id, addressee_id)` — enforce one relationship record per user pair
- [ ] Add CHECK constraint: `requester_id != addressee_id` (cannot friend yourself)
- [ ] Add `avatar_id` TEXT column to `users` table (default NULL — shows default initials avatar)
- [ ] Add `friend_code` TEXT UNIQUE column to `users` table — personal shareable code for friend link discovery (generated on account creation, 8-char alphanumeric, cryptographically random)
- [ ] Create migration to generate `friend_code` for all existing users
- [ ] Prepare ~20–30 predefined LOTR-themed avatar images in `public/img/avatars/` (WebP, 128×128, <10KB each)
- [ ] Avatar filenames are the `avatar_id` slug (e.g., `gandalf-grey`, `samwise`, `eowyn`)
- [ ] Thumbnails in `public/img/avatars/thumbs/` (32×32) for Map marker use
- [ ] Add indexes: `idx_friendships_requester` on `requester_id`, `idx_friendships_addressee` on `addressee_id`, `idx_friendships_status` on `status`
- [ ] Document schema in `docs/data-models.md`

**FRs:** FR_FRIEND_01, FR_FRIEND_02, FR_FRIEND_07

**Technical Notes:**
- Mutual friendship model: when accepted, query both directions (WHERE (requester=A AND addressee=B) OR (requester=B AND addressee=A))
- `friend_code` follows the same pattern as party `invite_code` — non-enumerable, cryptographically secure
- Avatar assets follow the same `image_id` slug pattern as `goals.image_id`
- No user-uploaded images — predefined gallery only (avoids R2, moderation, and abuse concerns)

**Dependencies:** None

---

#### Story 6.2: Friend Request API (Issue #TBD)

**Priority:** P1

**Description:** API endpoints for sending, accepting, rejecting, and removing friends. Includes username search and friend link resolution.

**Acceptance Criteria:**
- [ ] `GET /api/friends` — List current user's accepted friends: `{ id, username, avatar_id, last_progressed }` where `last_progressed` is the date of their most recent `progress` entry
- [ ] `GET /api/friends/pending` — List pending incoming requests: `{ id, username, avatar_id, created_at }`. Also return count for badge.
- [ ] `GET /api/friends/search?q=<username>` — Search users by username prefix (min 3 chars). Return `{ id, username, avatar_id, friendship_status }` where status is null/pending/accepted. Limit 10 results. Exclude current user.
- [ ] `GET /api/friends/resolve/:friendCode` — Resolve a friend code to user preview: `{ username, avatar_id }`. Returns 404 for invalid codes.
- [ ] `POST /api/friends/request` — Send friend request. Body: `{ user_id: number }`. Creates pending friendship. Returns 400 if already friends/pending, 404 if user not found.
- [ ] `POST /api/friends/request/code` — Send friend request via friend code. Body: `{ friend_code: string }`. Resolves code to user, creates pending friendship.
- [ ] `POST /api/friends/:friendshipId/accept` — Accept pending request. Only the addressee can accept.
- [ ] `POST /api/friends/:friendshipId/reject` — Reject pending request. Deletes the friendship record. Only the addressee can reject.
- [ ] `DELETE /api/friends/:friendshipId` — Remove friend (mutual unfriend). Deletes the friendship record. Either party can remove.
- [ ] All endpoints validate session (401 if unauthenticated)
- [ ] IDOR prevention: friendship operations validate the current user is a party to the friendship record
- [ ] Rate limit friend requests: max 20 outgoing pending requests at any time

**FRs:** FR_FRIEND_01, FR_FRIEND_02, FR_FRIEND_03, FR_FRIEND_04, FR_FRIEND_05, FR_FRIEND_08

**Technical Notes:**
- `last_progressed` is computed as `SELECT MAX(date) FROM progress WHERE user_id = ?` — efficient with existing indexes
- Username search uses `LIKE ? || '%'` on the `username` column (case-insensitive)
- Friend code resolution is a simple index lookup on `users.friend_code`

**Dependencies:** Story 6.1

---

#### Story 6.3: Fellowship Invite via Friends API (Issue #TBD)

**Priority:** P1

**Description:** API endpoints for inviting friends to a fellowship (acceptance required) and accepting/rejecting fellowship invites.

**Acceptance Criteria:**
- [ ] Create `fellowship_invites` table: id, party_id (FK → parties.id ON DELETE CASCADE), inviter_id (FK → users.id), invitee_id (FK → users.id), status ('pending', 'accepted', 'rejected'), created_at
- [ ] UNIQUE constraint on `(party_id, invitee_id)` per pending invite — prevent duplicate pending invites to same user for same party
- [ ] `POST /api/party/:id/invite-friend` — Invite a friend to the fellowship. Body: `{ user_id: number }`. Validates: inviter is active member, invitee is a friend (accepted friendship), invitee is not already an active member, party is not dissolved. Creates pending invite.
- [ ] `GET /api/user/fellowship-invites` — List pending incoming fellowship invites: `{ id, party_id, party_name, member_count, total_distance, inviter_username, created_at }`. Also return count for badge.
- [ ] `POST /api/user/fellowship-invites/:inviteId/accept` — Accept invite. Joins the party (same logic as `POST /api/party/join/:inviteCode` — records `distance_at_join`, sets status active). Marks invite as accepted.
- [ ] `POST /api/user/fellowship-invites/:inviteId/reject` — Reject invite. Marks invite as rejected.
- [ ] Only the invitee can accept/reject their own invites
- [ ] Invalidate pending invites when a party is dissolved
- [ ] Existing invite-code join flow remains functional — friend invites are an additional pathway, not a replacement

**FRs:** FR_PARTY_14, FR_PARTY_15, FR_PARTY_16

**Technical Notes:**
- `member_count` and `total_distance` for the invite preview are computed the same way as `GET /api/user/parties`
- Acceptance reuses the same join logic as invite-code joins (Story 3.3) to maintain consistency

**Dependencies:** Story 6.2, Story 3.3 (Fellowship Join API)

---

#### Story 6.4: Friends UI — Friends Page & Friend Profile (Issue #TBD)

**Priority:** P1

**Description:** Friends list page accessible from the navigation drawer, friend profile page, and pending request management. Fellowship invite acceptance also surfaces on the Fellowships list page.

**Acceptance Criteria:**

**Friends Page (`/friends`)**
- [ ] Create `/friends` route with SSR shell (`renderFriendsPage.ts` following `renderLayout()` pattern) and Preact island
- [ ] **Add "Friends" link to DrawerIsland** navigation (alongside Journey, Map, Fellowships)
- [ ] **Badge on Friends nav link** showing count of pending incoming friend requests
- [ ] **Pending Requests section** at top (collapsible): each shows username, avatar, "Accept" / "Reject" buttons
- [ ] **Friends list**: username, avatar (32px circle), last progressed date (e.g., "3 days ago"). Clicking a friend navigates to their profile.
- [ ] **Search section**: username search input (min 3 chars, debounced 300ms). Results show username, avatar, friendship status, and "Add Friend" button for non-friends / "Pending" label / "Friends ✓" label.
- [ ] **Share friend link section**: Display personal friend link (`{origin}/friends/add/{friendCode}`) with "Copy Link" button. Uses same copy/share pattern as fellowship invite links.
- [ ] **Empty state**: "No friends yet" with prompt to search or share link
- [ ] **Loading skeleton** while data loads

**Friend Link Landing Page (`/friends/add/:friendCode`)**
- [ ] Create `/friends/add/:friendCode` route with SSR shell and Preact island
- [ ] **Authenticated users**: Show user preview (username, avatar) via `GET /api/friends/resolve/:friendCode`. "Send Friend Request" button.
- [ ] **Non-authenticated users**: Same preview with "Log in to Add Friend" button (redirects to login with `returnTo`)
- [ ] **Error states**: Invalid code, already friends, pending request, self-add

**Friend Profile Page (`/friends/:id`)**
- [ ] Create `/friends/:id` route with SSR shell and Preact island
- [ ] Show: username (large), avatar (128px), total distance walked, member since date
- [ ] **Fellowships section**: List fellowships the friend belongs to. Highlight shared fellowships with a distinct visual (e.g., "✦ Shared" badge). Non-shared fellowships show name only (no join shortcut to avoid bypassing invite flow).
- [ ] **Remove Friend** button with confirmation dialog
- [ ] **Back navigation**: `← Friends / [Username]`
- [ ] Return 404 if not friends with this user (privacy: can only view friends' profiles)

**Fellowship Invites on Fellowships Page**
- [ ] **Badge on Fellowships nav link** showing count of pending fellowship invites
- [ ] **New "Pending Invites" section** on Fellowships list page (`/party`): each shows party name, member count, total distance, invited by username. "Accept" / "Decline" buttons.
- [ ] On accept: user joins the fellowship and invite disappears from list (party appears in active fellowships)

**Add Friend from Fellowship Detail**
- [ ] On Fellowship detail page (`/party/:id`), show "Add Friend" icon/button next to members who are not already the user's friend and have no pending request
- [ ] Clicking sends a friend request inline (button changes to "Pending")

**Cross-cutting:**
- [ ] All pages follow existing accessibility patterns (ARIA, focus, keyboard, WCAG AA)
- [ ] All pages functional on ≥320px screens
- [ ] `history.pushState` for navigation

**FRs:** FR_FRIEND_01, FR_FRIEND_02, FR_FRIEND_03, FR_FRIEND_04, FR_FRIEND_05, FR_FRIEND_06, FR_FRIEND_08, FR_PARTY_15, FR_PARTY_16, FR_PARTY_17

**Dependencies:** Story 6.2, Story 6.3

---

#### Story 6.5: Avatar UI — Avatar Selection (Issue #TBD)

**Priority:** P1

**Description:** Avatar gallery picker in profile settings and avatar display integration across all surfaces.

**Acceptance Criteria:**
- [ ] **Avatar gallery in Profile Settings modal**: Grid of all available predefined avatars (~20–30). Selecting one calls `PUT /api/user/preferences` with `{ avatar_id: string }`. Current selection highlighted.
- [ ] **Default avatar**: When `avatar_id` is NULL, render a circle with the user's initials (first letter of username, uppercase) on a deterministic background color (seeded from user ID)
- [ ] **Avatar display integration**: Render avatar consistently across:
  - [ ] Profile Settings modal (128px, large preview)
  - [ ] Friends list (32px inline)
  - [ ] Friend profile page (128px hero)
  - [ ] Fellowship member lists (24px inline)
  - [ ] Navigation drawer (32px, next to username)
- [ ] **`/api/session` response** includes `avatar_id` for client-side rendering
- [ ] **Avatar component**: Create a reusable `Avatar` Preact component (`client/src/components/Avatar.tsx`) that handles both predefined images and initials fallback, accepting `size`, `avatarId`, and `username` props
- [ ] **Cache**: Avatar images use long cache headers (immutable assets in `public/img/avatars/`)

**FRs:** FR_FRIEND_07

**Technical Notes:**
- `PUT /api/user/preferences` already exists — add `avatar_id` to accepted fields
- Validate `avatar_id` against a known list of avatar slugs on the server (prevent invalid values)

**Dependencies:** Story 6.1

---

#### Story 6.6: Map Social Panel & Friends on Map (Issue #TBD)

**Priority:** P2

**Description:** Replace the fellowship-only selector on the Map page with a unified Social panel. Add friend avatar markers at their journey positions.

**Acceptance Criteria:**

**Social Panel (replaces fellowship selector)**
- [ ] Rename existing fellowship selector button to "Social" (or use a people icon)
- [ ] Panel opens with two sections:
  - **"View As"** section: Personal + list of user's fellowships (same behavior as current selector)
  - **"Friends on Map"** section: Toggle switch to show/hide friend avatars
- [ ] Both sections are independent — fellowship view and friend visibility can be combined
- [ ] Toggle state persists to `localStorage` (same pattern as fellowship view preference)
- [ ] Panel design follows existing Map panel patterns (same width, animation, close behavior)

**Friend Avatars on Map**
- [ ] `GET /api/friends/positions` — New endpoint: Returns each friend's interpolated position on the journey path. Response: `[{ user_id, username, avatar_id, total_distance }]`. Only returns accepted friends. Position interpolation is client-side (using existing path coordinate utilities).
- [ ] Render friend avatars as circular images (32px, using `public/img/avatars/thumbs/`) at each friend's interpolated path position
- [ ] Default avatar (initials circle) for friends without `avatar_id`
- [ ] Avatars scale with zoom level (same `dynamicStrokeWidth` scaling approach used by map paths)
- [ ] **Tap/click avatar**: Show mini-card tooltip: username, avatar (64px), total distance, "View Profile →" link to `/friends/:id`
- [ ] Mini-card dismissible (tap outside, ESC)
- [ ] **Performance**: Avatars only render for friends within the visible viewport bounds (frustum culling). Positions endpoint is cached for 5 minutes client-side.
- [ ] **Overlap handling**: When friend avatars overlap at similar distances, offset slightly along the perpendicular axis. At low zoom, cluster nearby friends with a count badge.
- [ ] **Current user marker**: Ensure the user's own position marker renders above friend avatars (higher z-index)

**FRs:** FR_FRIEND_09, FR_FRIEND_10, FR_PARTY_08

**Technical Notes:**
- The Social panel replaces the fellowship selector button but preserves all existing fellowship selection behavior
- Friend position interpolation reuses `interpolatePosition()` from existing map path utilities
- Avatar thumbnails (32×32 WebP) are tiny and pre-cached by the service worker
- The `GET /api/friends/positions` endpoint is deliberately minimal — it only returns `total_distance` and lets the client interpolate position from the path coordinates it already has

**Dependencies:** Story 6.2, Story 2.3 (Journey Path), Story 3.6 (Fellowship Selector)

---

## Summary

| Epic | Issue # | Stories | Priority Range |
|------|---------|---------|----------------|
| Epic 1: Phase 1 Polish | #150 | 9 | P0-P3 |
| Epic 2: Interactive Map | #151 | 8 | P1-P2 |
| Epic 3: Fellowship | #152 | 10 | P0-P3 |
| Epic 4: Admin Portal | #153 | 6 | P0-P2 |
| Epic 5: Races | #154 | 6 | P0-P2 |
| Epic 6: Friends & Social Identity | TBD | 6 | P0-P2 |
| **Total** | | **45** | |

### Recommended Implementation Order

1. **Epic 1** (#150) - Stories 1.1-1.2 first as blockers, then remaining
2. **Epic 2** (#151) - After Preact infrastructure
3. **Epic 3** (#152) - Core Fellowship features
4. **Epic 4** (#153) - Admin portal after Fellowship stabilization and architecture alignment
5. **Epic 6** (TBD) - Friends & Social Identity, can run in parallel with or after Epic 4
6. **Epic 5** (#154) - Races, leverages Fellowship + Friends + Admin patterns; requires Epic 6 alignment

