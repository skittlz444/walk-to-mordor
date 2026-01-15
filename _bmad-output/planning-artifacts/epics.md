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
| **FR_PARTY_01** | Users can create a new Fellowship (party) and become the leader |
| **FR_PARTY_02** | Users can invite other users to join their Fellowship |
| **FR_PARTY_03** | Users can accept or decline Fellowship invitations |
| **FR_PARTY_04** | Users can view combined Fellowship progress (total distance) |
| **FR_PARTY_05** | Users can see individual member contributions within the Fellowship |
| **FR_PARTY_06** | Users can leave a Fellowship at any time |

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
| **ARCH_BUILD_01** | Build Config | Need preact/compat aliased for react-konva |
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
| FR_PARTY_01 | Epic 3 | Create Fellowship |
| FR_PARTY_02 | Epic 3 | Invite users to Fellowship |
| FR_PARTY_03 | Epic 3 | Accept/decline invitations |
| FR_PARTY_04 | Epic 3 | View combined Fellowship progress |
| FR_PARTY_05 | Epic 3 | See individual member contributions |
| FR_PARTY_06 | Epic 3 | Leave Fellowship |

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

**Goal:** Users can create/join parties (Fellowships), view combined group progress, and share their journey with friends for social motivation.

**FRs Covered:** FR_PARTY_01, FR_PARTY_02, FR_PARTY_03, FR_PARTY_04, FR_PARTY_05, FR_PARTY_06

**Tech:** ADR-004 (parties, party_members tables)

**Includes:**
- Create/invite/view party features (#139)
- Shared progress tracking
- Party pace calculations
- Privacy controls (opt-in sharing)

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
- [ ] Configure esbuild (or vite) for Preact compilation with `preact/compat` alias for react-konva compatibility
- [ ] Configure TypeScript for client code (separate tsconfig.client.json if needed)
- [ ] Create npm scripts: `build:client`, `dev:client` (watch mode)
- [ ] Create a sample "HelloWorld" Preact island component that renders to a `<div id="preact-root">` placeholder
- [ ] Document the island mounting pattern in `docs/architecture.md`
- [ ] Verify build outputs to `public/js/islands/` or equivalent assets location

**Technical Notes:**
- Must alias `react` → `preact/compat` and `react-dom` → `preact/compat` for Konva compatibility
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

**Description:** Enable insertion of new narrative milestones between existing goals to improve story pacing and density, without breaking existing user progress.

**Acceptance Criteria:**
- [ ] Add `sort_order` column to goals table for flexible ordering
- [ ] Create migration script to populate `sort_order` for existing goals
- [ ] Update goal queries to ORDER BY sort_order, not by distance alone
- [ ] Create admin SQL script template for inserting intermediary goals
- [ ] Verify existing user progress is unaffected after intermediary insertion
- [ ] Document the process for adding intermediary goals in `docs/`
- [ ] Add 5+ intermediary goals as sample content (e.g., early Shire sections)

**FRs:** FR_ADM_02

**Dependencies:** None

---

#### Story 1.5: Missing Milestone Images (Issue #105)

**Priority:** P2

**Description:** Identify and add missing images for all 171 milestones, ensuring every goal has associated high-quality imagery.

**Acceptance Criteria:**
- [ ] Audit all 171 goals for missing `image_url` values
- [ ] Source/generate images for missing milestones (license-appropriate)
- [ ] Optimize all new images to WebP format, <25MB each (NFR_CONST_01)
- [ ] Create thumbnail versions for list views (< 100KB)
- [ ] Update database with correct image paths
- [ ] Verify all milestone detail views display images correctly

**FRs:** FR_LORE_05

**Dependencies:** None

---

#### Story 1.6: Image Optimization Script (Issue #157)

**Priority:** P2

**Description:** Create automated script to process and optimize milestone images for production use.

**Acceptance Criteria:**
- [ ] Create Node.js script in `scripts/optimize-images.js`
- [ ] Input: source images folder, Output: optimized WebP + thumbnails
- [ ] Generate high-res WebP (max 1920px width, quality 85)
- [ ] Generate thumbnail WebP (max 400px width, quality 80)
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
- [ ] Add background color + padding to modal buttons (match auth button styling)
- [ ] Add "km" suffix or placeholder to distance input field
- [ ] Add +1km and +5km quick entry buttons that populate input
- [ ] Quick buttons should add to existing value if present
- [ ] Ensure touch targets ≥44x44 CSS pixels (NFR_ACC_02)
- [ ] Test on mobile viewport

**FRs:** UX_MODAL_01, UX_INPUT_01, UX_ENTRY_01

**Dependencies:** None

---

#### Story 1.8: UX Polish - Goals Display Improvements (Issue #159)

**Priority:** P2

**Description:** Enhance goals/milestones display with section headers, next goal emphasis, and progress bar.

**Acceptance Criteria:**
- [ ] Add location-based section headers ("The Shire", "Bree", "Rivendell", etc.)
- [ ] Make first upcoming/next goal visually larger/highlighted
- [ ] Add simple progress bar showing percentage to next milestone
- [ ] Progress bar positioned under total distance display
- [ ] Ensure proper contrast (NFR_ACC_01 - WCAG AA)

**FRs:** UX_GOAL_01, UX_GOAL_02, UX_PROG_01

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

**Tech:** Konva.js, react-konva with preact/compat

**Dependencies:** Story 2.1, Story 1.1

---

#### Story 2.3: Journey Path Rendering (Issue #163)

**Priority:** P1

**Description:** Render the user's journey as a visual breadcrumb trail on the map showing completed segments.

**Acceptance Criteria:**
- [ ] Define path coordinates for the complete Hobbiton→Mordor route
- [ ] Render completed path segments as colored line (gold/amber theme)
- [ ] Path renders from journey start to user's current position
- [ ] Line style: dashed or dotted for "walking" aesthetic
- [ ] Path updates when user progress changes
- [ ] Uncompleted path shown as faded/grayed (optional, for context)

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

#### Story 2.8: Map Visual Testing (Issue #168)

**Priority:** P2

**Description:** Create Playwright visual regression tests for map rendering.

**Acceptance Criteria:**
- [ ] Create snapshot tests for map at default zoom
- [ ] Create snapshot tests for map at zoomed in/out states
- [ ] Test path rendering with mock progress data
- [ ] Test waypoint marker visibility at different zoom levels
- [ ] Document snapshot update process
- [ ] Tests run in CI pipeline

**NFRs:** ARCH_TEST_01, NFR_TEST_01

**Dependencies:** Story 2.5

---

### Epic 3: Fellowship Features

#### Story 3.1: Fellowship Database Schema (Issue #169)

**Priority:** P0 (Blocker)

**Description:** Create database tables for Fellowship (party) functionality.

**Acceptance Criteria:**
- [ ] Create `parties` table: id, name, leader_id, created_at, invite_code (unique)
- [ ] Create `party_members` table: id, party_id, user_id, joined_at, **distance_at_join** (DECIMAL), role (leader/member), status (active/left)
- [ ] Create `party_progress_log` table: id, party_id, logged_by_user_id, distance, logged_at (for activity feed)
- [ ] Add indexes for common queries (party lookups, member listings)
- [ ] Create migration file in `migrations/` folder
- [ ] Document schema in `docs/data-models.md`

**FRs:** FR_PARTY_01, ADR-004

**Technical Notes:**
- `distance_at_join` stores the user's total distance at the moment they join, enabling both "cumulative" and "incremental" progress modes.

**Dependencies:** None

---

#### Story 3.2: Create Fellowship API (Issue #170)

**Priority:** P1

**Description:** API endpoint for creating a new Fellowship with the current user as leader.

**Acceptance Criteria:**
- [ ] POST `/api/party` - Create new party
- [ ] Request body: { name: string }
- [ ] Generate unique invite code (8 char alphanumeric)
- [ ] Set creator as leader in party_members with `distance_at_join` = current total distance
- [ ] Return party details including invite code
- [ ] Validate: name required, max 50 chars
- [ ] Validate: user not already leader of another active party (optional limit)
- [ ] Return 401 if not authenticated

**FRs:** FR_PARTY_01

**Dependencies:** Story 3.1

---

#### Story 3.3: Invite & Join Fellowship API (Issue #171)

**Priority:** P1

**Description:** API endpoints for inviting users and joining via invite code.

**Acceptance Criteria:**
- [ ] GET `/api/party/join/:inviteCode` - Preview party before joining (name, member count)
- [ ] POST `/api/party/join/:inviteCode` - Join party via invite code
- [ ] On join: Record `distance_at_join` = user's current total distance
- [ ] POST `/api/party/:id/invite` - Generate new invite link (leader only)
- [ ] Validate: User can only be in one active party at a time
- [ ] Validate: Cannot join own party twice
- [ ] Return 404 for invalid invite codes
- [ ] Return 403 if user already in a different party

**FRs:** FR_PARTY_02, FR_PARTY_03

**Dependencies:** Story 3.2

---

#### Story 3.4: Fellowship Progress Calculation API (Issue #172)

**Priority:** P1

**Description:** API endpoint to calculate and return combined Fellowship progress with flexible counting modes.

**Acceptance Criteria:**
- [ ] GET `/api/party/:id/progress` - Get party progress
- [ ] Support query param: `?mode=cumulative|incremental` (default: incremental)
- [ ] **Cumulative Mode:** Sum of all members' total distances (all-time)
- [ ] **Incremental Mode:** Sum of (member total distance - distance_at_join) for each member (only counts progress since joining)
- [ ] Return: total_distance, member_count, calculated_position (milestone)
- [ ] Include breakdown by member: { user_id, display_name, contribution }
- [ ] For incremental mode, `contribution` = current total - distance_at_join
- [ ] Cache calculation for 5 minutes (invalidate on new log)

**FRs:** FR_PARTY_04, FR_PARTY_05

**Technical Notes:**
- The `distance_at_join` field enables fair contribution tracking regardless of when members joined.

**Dependencies:** Story 3.3

---

#### Story 3.5: Leave Fellowship API (Issue #173)

**Priority:** P1

**Description:** API endpoint for members to leave a Fellowship.

**Acceptance Criteria:**
- [ ] POST `/api/party/:id/leave` - Leave party
- [ ] Set member status to 'left' (soft delete, preserve history)
- [ ] If leader leaves: transfer leadership to oldest member, or dissolve if empty
- [ ] Return success confirmation
- [ ] Validate: User must be member of party
- [ ] Recalculate party progress after member leaves (exclude left members)

**FRs:** FR_PARTY_06

**Dependencies:** Story 3.3

---

#### Story 3.6: Fellowship UI - Dashboard Integration (Issue #174)

**Priority:** P1

**Description:** Add Fellowship section to main dashboard showing party status or join prompt.

**Acceptance Criteria:**
- [ ] If in party: Show party name, member count, combined progress
- [ ] If not in party: Show "Create or Join Fellowship" CTA
- [ ] Link to dedicated Fellowship management page
- [ ] Show party progress towards current milestone (mini progress bar)
- [ ] Real-time update when new walk logged (via existing refresh)

**FRs:** FR_PARTY_04

**Dependencies:** Story 3.4, Story 1.1

---

#### Story 3.7: Fellowship UI - Management Page (Issue #175)

**Priority:** P2

**Description:** Dedicated page for managing Fellowship membership and viewing details.

**Acceptance Criteria:**
- [ ] Create `/party` route
- [ ] Show party details: name, invite code (copyable), member list
- [ ] Member list shows: name, contribution, joined date
- [ ] Contribution display based on selected mode (toggle switch)
- [ ] Leader actions: regenerate invite code, remove member (future)
- [ ] Member actions: Leave party button with confirmation
- [ ] Create party form (if not in party)
- [ ] Join party form with invite code input

**FRs:** FR_PARTY_01, FR_PARTY_02, FR_PARTY_05, FR_PARTY_06

**Dependencies:** Story 3.6

---

#### Story 3.8: Fellowship Progress Activity Feed (Issue #176)

**Priority:** P2

**Description:** Show recent activity from Fellowship members as a feed.

**Acceptance Criteria:**
- [ ] Display last 10 party member activities
- [ ] Format: "[Member] walked [X] km on [Date]"
- [ ] Auto-refresh every 60 seconds (or on page focus)
- [ ] Distinguish own activities from others
- [ ] Show "No recent activity" placeholder when empty
- [ ] Privacy: Only show to party members

**FRs:** FR_PARTY_05

**Dependencies:** Story 3.7

---

#### Story 3.9: Fellowship Notifications - Party Milestones (Issue #177)

**Priority:** P3

**Description:** Notify party members when the Fellowship reaches a new milestone together.

**Acceptance Criteria:**
- [ ] Detect when party progress crosses a milestone threshold
- [ ] In-app notification/toast for all members on next page load
- [ ] Optional: Email notification (digest-style, not per-milestone)
- [ ] Notification shows: "Your Fellowship reached [Milestone Name]!"
- [ ] One-time notification per milestone per user (don't repeat)

**FRs:** FR_PARTY_04, FR_LORE_01

**Dependencies:** Story 3.4, Story 1.2

---

#### Story 3.10: Fellowship Privacy & Authorization (Issue #178)

**Priority:** P1

**Description:** Ensure proper authorization and privacy controls for Fellowship features.

**Acceptance Criteria:**
- [ ] All party endpoints validate user membership
- [ ] Party data only visible to members
- [ ] Invite code is only secret (not enumerable)
- [ ] User's individual progress remains private (not exposed via party)
- [ ] Party progress is opt-in (members chose to join)
- [ ] IDOR prevention: verify party_id access on every request

**NFRs:** NFR_SEC_02, NFR_PRIV_01

**Dependencies:** Story 3.2

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

