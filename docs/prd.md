---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
classification:
  projectType: web_app
  domain: general
  complexity: medium
  projectContext: brownfield
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-walk-to-mordor-2026-01-14.md
  - docs/project-summary.md
  - docs/architecture.md
  - README.md
  - docs/archive/AUTHENTICATION.md
  - docs/archive/EMAIL_SETUP.md
  - docs/archive/TESTING.md
  - docs/archive/TEST_ORGANIZATION.md
  - docs/archive/USER_ISOLATION_VERIFICATION.md
workflowType: 'prd'
---

## Executive Summary

Walk to Mordor is a gamified fitness tracking Progressive Web App (PWA) that transforms daily walking or running routines into an epic journey through J.R.R. Tolkien's Middle-earth. By mapping real-world physical activity to the legendary 6,425 km quest from the Shire to Mount Doom (and back), the application solves the problem of exercise boredom by providing deep narrative context, visual progress tracking, and long-term motivation for Lord of the Rings fans of all fitness levels.

## Success Criteria

### User Success

*   **Routine Formation**: Uses app 2-3 times per week consistently.
*   **Immersion**: Reads milestone descriptions.
*   **Accessibility**: Can log a walk in under 30 seconds on mobile (Standard "getting out the door" friction test).

### Business Success (Personal Project Context)

*   **Stability**: Zero maintenance "pagers" - system runs itself.
*   **Lore Fidelity**: Zero "Lore Bug" reports (e.g., "Frodo wasn't there on day 45").
*   **Metric**: Active User Retention > 30% after 3 months (High for fitness apps).

### Technical Success

*   **Test Coverage**: Maintain strict >90% coverage (Backend & UI).
*   **Performance**: <1s TTI on 4G networks.
*   **Isolation**: 100% Data isolation between users (verified by tests), **UNTIL** implementation of multiplayer features, which will require updated isolation rules to allow controlled data sharing between Fellowship members.

## User Journeys

### 1. The "Samwise" Happy Path (Core Loop)
*   **Scene:** Sam finishes a rainy Tuesday dog walk. It was wet and miserable.
*   **Action:** Opens app on phone (PWA). Taps today's date. Enters "3.5 km".
*   **Climax:** A modal pops up! "You have reached the Three-Farthing Stone". He reads the description of looking back at Hobbiton.
*   **Resolution:** The rain doesn't matter anymore; he's on an adventure. He feels accomplished.

### 2. The "Bilbo" Onboarding (New User)
*   **Scene:** Bilbo is scrolling on his couch, feeling guilty about not exercising. He sees a link to "Walk to Mordor".
*   **Action:** Clicks link. Sees "Join the Quest" (No friction). Creates account.
*   **Climax:** He logs his first 1km walk to the mailbox and back. He sees the "Distance to next goal" drop by 1km.
*   **Resolution:** It's real. He's started. He wants to see that number hit zero.

### 3. The "Strider" Power User (Data Integrity)
*   **Scene:** Strider just ran a marathon (42km). He wants to log it, but realizes he made a typo yesterday (logged 50km instead of 5km).
*   **Action:** Goes to calendar. Finds yesterday. Edits entry. Logs today's massive run.
*   **Climax:** He checks his "Total Distance". He's passed Rivendell weeks ahead of schedule.
*   **Resolution:** He feels powerful and efficient. The tool didn't get in his way.

### 4. The "Aragorn" (Fellowship Leader)
*   **Scene:** Aragorn has created two Fellowships — one for his running club and one for a family challenge.
*   **Action:** He opens the Fellowships page, selects his running club party, sees the member list and combined progress.
*   **Climax:** He notices a suspicious entry from one member. He kicks them (removing their distance) and checks the Map view — each member's contributed segment is clearly visible.
*   **Resolution:** The group stays fair and motivated. He swaps to his family party on the Journey page to check their progress toward Rivendell.

### 5. The "Gandalf" (System Admin/Developer)
*   **Scene:** Gandalf receives a user suggestion for a "Dark Mode" to save battery on long hikes.
*   **Action:** He logs a GitHub issue: "Feature Request: Dark Mode".
*   **Climax:** He commands his magic staff (Copilot): "Scaffold the CSS variables for a dark mode theme."
*   **Resolution:** The feature is planned and scaffolding begins. The magic works.




## Project Scoping & Phased Development

### MVP Strategy & Philosophy
**MVP Approach:** **Experience MVP**
The current live version serves as the MVP core. The immediate focus is resolving friction in the onboarding process and polishing the narrative content to ensure the "hook" is solid before scaling complexity.

**Resource Requirements:** Single Developer (Gandalf Persona) with AI assistance.

### Phase 1: Polish & Friction Removal ✅ Complete (Epic 1)
*Focus: improving the solo user experience and removing administrative bottlenecks.*
*   ✅ **Registration Flow:** Migrated from manual approval to email confirmation (#149) to allow autonomous user growth.
*   ✅ **Narrative Pacing:** Added intermediary goals (#140) to break up large distance gaps (keeping goals <70km apart).
*   ✅ **Visual Completion:** Added missing photos for all 171 milestones (#105) in WebP format with lazy loading.
*   ✅ **Process:** Established BMAD workflows (#142).
*   ✅ **Frontend Architecture:** Migrated key UI components to Preact islands (AuthForms, GoalModal, NextGoalCard, UpcomingGoalCard).
*   ✅ **UX Polish:** Modal styling, distance input clarity, quick entry buttons, profile icon updates.

### Phase 2: The Atlas (Visual Immersion)
*Focus: Enhancing the individual user's connection to the world.*
*   **Interactive Map:** Implement a map view showing completed progress lines and goal points (#138).
    *   *Technical Note:* This is a frontend-heavy feature involving SVG/Canvas work and does not require complex backend changes, making it a logical next step before multiplayer.

### Phase 3: The Fellowship (Multiplayer)
*Focus: Adding social and competitive layers on top of the solid solo foundation.*
*   **Party Management:** Create/Invite/View/Leave Party features (#139). Users can belong to multiple parties simultaneously.
*   **Party Settings:** Party leaders configure distance calculation mode (cumulative/incremental) and member leave behavior (keep/remove contributed distance) at creation time. Settings can be updated after creation.
*   **Shared Progress:** Combined distance tracking with per-member color-coded contribution segments visible on Journey and Map pages.
*   **Party Leader Controls:** Leaders can kick members with optional distance removal override. Leaders can transfer leadership to another active member without leaving.
*   **Party Lifecycle:** Empty parties (all members departed) are automatically dissolved (soft-deleted). Users who leave or are kicked can re-join via invite code.
*   **Multi-Party UI:** Journey and Map pages include a party selector (hidden if user has no parties) to toggle between personal distance and any party's combined distance. Fellowships page starts with party selection. Navigation drawer includes link to Fellowships page.
*   **Party Milestone Notifications:** Swapping to a party view that has passed a new milestone since the user last viewed it triggers the milestone modal.
*   **Personalization (Future):** User custom map icons and fellowship profile icons for visual distinction.
*   **Races:** Challenge functionality between users/parties.
*   *Requirement:* This phase introduces complex database relations and potential privacy refactoring.

### Phase 4: Expansion (Content Scale)
*Focus: widening the content library once the platform features are complete.*
*   **New Storylines:** Alternative narrative arcs (Aragorn, Boromir, The Hobbit) (#141).
*   **Complex Logistics:** Handling "split parties" where members are on different timelines/routes.

### Risk Mitigation Strategy
*   **Scope Creep:** By separating **Atlas** (Visuals) from **Fellowship** (Data), we avoid trying to build a "Live Multiplayer Map" all at once. We build the Map first for solo, *then* add other people's dots to it.
*   **Content Volume:** Phase 4 is deferred because writing/sourcing content for 8+ new storylines is a massive non-technical undertaking.

## Functional Requirements

### 1. User Management & Authentication
*   **FR_AUTH_01:** Users can create a new account using an email and password.
*   **FR_AUTH_02:** Users can log in to their account to access their private data.
*   **FR_AUTH_03:** Users must confirm their email address to activate their account (replacing manual approvals).
*   **FR_AUTH_04:** Users can request a password reset functionality via email if they forget their credentials.
*   **FR_AUTH_05:** The System must enforce strict data isolation so users can only view and edit their own logs.

### 2. Core Activity Loop (Logging & Editing)
*   **FR_LOG_01:** Users can log a walking/running activity for a specific date.
*   **FR_LOG_02:** Users can log distance in partial kilometers (e.g., 3.5 km).
*   **FR_LOG_03:** Users can view a calendar or timeline of their past logged activities.
*   **FR_LOG_04:** Users can edit or delete past activity entries to correct errors (e.g., typos).
*   **FR_LOG_05:** The System must automatically recalculate the user's Total Cumulative Distance immediately after any log update.

### 3. Narrative & Progression (Lore Engine)
*   **FR_LORE_01:** The System must compare the User's Total Cumulative Distance against a predefined specific list of 171 Narrative Milestones.
*   **FR_LORE_02:** The System must unlock all Milestones whose distance threshold has been exceeded by the User.
*   **FR_LORE_03:** Users can view a list of all unlocked Milestones.
*   **FR_LORE_04:** Users can read rich text descriptions associated with unlocked Milestones.
*   **FR_LORE_05:** Users can view high-quality static imagery associated with unlocked Milestones.
*   **FR_LORE_06:** Users can view the numeric distance remaining until the *next* locked Milestone.
*   **FR_LORE_07:** Users can scroll ahead to see the titles (but potentially obscured details) of future locked Milestones to build anticipation.

### 4. Project & Content Management (Admin)
*   **FR_ADM_01:** Administrators can update Milestone descriptions (typos, lore corrections) via the database/codebase deployment updates.
*   **FR_ADM_02:** The System allows for the insertion of new "Intermediary" Milestones without breaking existing user progress logic.

### 5. Visual Immersion (The Atlas - Phase 2)
*   **FR_MAP_01:** Users can view their current calculated position projected onto a stylized map of Middle-earth.
*   **FR_MAP_02:** Users can see a visual "breadcrumb" trail corresponding to their completed journey segments on the map.
*   **FR_MAP_03:** Users can click interactive points on the map corresponding to unlocked milestones to view their details.

### 6. Fellowship Features (Phase 3)
*   **FR_PARTY_01:** Users can create a new Fellowship (party) and become the leader. Users can be members or leaders of multiple parties simultaneously.
*   **FR_PARTY_02:** Users can invite other users to join their Fellowship via shareable invite codes.
*   **FR_PARTY_03:** Users can join a Fellowship by entering or clicking an invite code (joining is the consent action).
*   **FR_PARTY_04:** Users can view combined Fellowship progress (total distance), with the distance calculation mode (cumulative or incremental) configured as a party setting by the leader.
*   **FR_PARTY_05:** Users can see individual member contributions within the Fellowship, including per-member color-coded segments on the Map view.
*   **FR_PARTY_06:** Users can leave a Fellowship at any time; the party's leave-distance setting (keep or remove contributed distance) determines the impact on party progress.
*   **FR_PARTY_07:** Party leaders can kick members from the Fellowship, with the ability to override the default leave-distance setting (e.g., remove a cheater's distance even if the default is to keep it).
*   **FR_PARTY_08:** Users can select between their personal distance and any of their parties' combined distance on the Journey and Map pages. The selector is hidden if the user is not a member of any party.
*   **FR_PARTY_09:** When a user switches to view a party that has passed a new milestone since the user last viewed that party's distance, the milestone modal is displayed for the latest passed milestone. This does not re-trigger when simply toggling between parties at different positions.
*   **FR_PARTY_10:** Party leaders can update party settings (distance calculation mode, leave-distance behavior) after party creation.
*   **FR_PARTY_11:** Party leaders can transfer leadership to another active member without leaving the party.
*   **FR_PARTY_12:** When all members have left a party, the party is automatically dissolved (soft-deleted). Members cannot re-join a dissolved party.
*   **FR_PARTY_13 (Future):** Users can set a custom icon/avatar to distinguish themselves on the Map view.
*   **FR_PARTY_14 (Future):** Party leaders can set a profile icon for their Fellowship.

## Non-Functional Requirements

### 1. Performance (The Standard of Experience)
*   **NFR_PERF_01:** The PWA must load the "Add Walk" modal and be ready for input in under **500ms** on an average 4G network (Time to Interactive).
*   **NFR_PERF_02:** The calendar calculation logic must render the user's history and current status in under **200ms** to prevent UI stutter.

### 2. Constraints & Platform Limits (Cloudflare Workers)
*   **NFR_CONST_01:** All static image assets (milestone photos) must be optimized (WebP/AVIF) to ensure the total deploy size remains manageable and individual files strictly respect the <25MB limit (though ideally <500kb for web perf).
*   **NFR_CONST_02:** Database queries must act within Cloudflare D1's specific read/write limits to avoid platform errors during peak usage.

### 3. Reliability & Availability (Online-First Strategy)
*   **NFR_REL_01:** The Application behaves as **Online-First**. If the user attempts to perform a write action (Log Walk) without a network connection, the UI must explicitly notify the user ("You are offline") rather than attempting complex background synchronization.
*   **NFR_REL_02:** The UI Shell (HTML/CSS/JS) must be cached via Service Worker to ensure the app *opens* instantly, even if dynamic data cannot yet be loaded.

### 4. Security & Privacy (Fellowship Preparation)
*   **NFR_SEC_01:** User passwords must be salted and hashed (using PBKDF2 or Argon2) before storage.
*   **NFR_SEC_02:** API endpoints must validate session ownership for *every* request to prevent IDOR (Insecure Direct Object Reference) attacks.
*   **NFR_PRIV_01:** Default state for all user data is **Private**. Data sharing for future "Fellowships" must require explicit opt-in.

### 5. Accessibility (The Bilbo Standard)
*   **NFR_ACC_01:** The color contrast of text-on-background (especially on the Calendar and Progress Bars) must meet **WCAG AA** standards.
*   **NFR_ACC_02:** All interactive elements (Day cells, Input fields) must be minimum 44x44 CSS pixels to ensure touch usability on small mobile screens.

## System Constraints & Compliance

### Lore Fidelity (Content Compliance)
*   **Constraint:** Content must adhere strictly to Tolkien's universe (dates, descriptions, events). References to time and place must be verified against the books.
*   **Mechanism:** Distance determines the narrative point.
*   **UX Freedom:** User activity is decoupled from narrative time. Users are **not** forced to "wait" (mechanically locked out) if their real-world pace exceeds narrative pace, nor are they skipped ahead.
*   **Verification:** Updates to lore descriptions must follow the `goal-description-update` verification standard.

### Platform Limits (Cloudflare Workers & Assets)
*   **Architecture:** Edge-native, D1 (SQLite) backend.
*   **Asset Limits:**
    *   **Max individual file size:** 25 MB (Hard limit).
    *   **File Count:** 20,000 (Free) / 100,000 (Paid).
*   **Constraint:** Assets (maps, images) must be optimized to stay under 25MB per file.

### Progressive Isolation (Privacy)
*   **Current State:** 100% Data isolation (Private by Default).
*   **Future Compatibility:** Architecture must allow for "Fellowship" features (controlled data sharing) without a full rewrite, but **strict isolation** remains the default state for all data until explicitly shared.

### Web App Strategy (PWA Standard)
*   **Service Worker:** App is primarily online-first. If offline, the app should frankly state "You are offline" rather than attempting complex background sync queues. Cache UI shell (HTML/CSS/JS) for instant load.
*   **Device Support:** No GPS required. Primary input is Manual Entry (consistent with "Samwise" journey). Touch targets optimized for 44x44px+.
*   **Responsive:** Mobile Portrait First. Desktop is functional but centered/padded. No IE11 support.
