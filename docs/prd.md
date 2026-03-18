---
name: prd
description: Product requirements document — features, user stories, and product scope decisions.
updated: 2026-03-17
lastEdited: 2026-03-17
editHistory:
  - date: 2026-03-17
    changes: Aligned phased roadmap with 12-phase plan; marked Phase 3 complete; expanded scope, success criteria, and NFR targets. Added User Journeys section and metric definitions.
---

# Product Requirements Document

## Product Vision

Walk to Mordor is a gamified fitness tracking PWA that maps daily walking/running to the 6,425 km quest from the Shire to Mount Doom (and back). It combines narrative context, visual progress tracking, fellowship mechanics, and rich milestone content to sustain long-term motivation for Lord of the Rings fans of all fitness levels. Future phases extend the experience with AI-powered narration, push re-engagement, time-limited events, and community challenges.

## Success Criteria

### User Success
- **Routine Formation**: Uses app 2–3 times/week consistently.
- **Immersion**: Reads milestone descriptions.
- **Accessibility**: Log a walk in under 30 seconds on mobile.
- **Fellowship Engagement**: > 40% of active users join at least one party.
- **Re-engagement**: > 50% of 3-day-inactive users return within 7 days of a nudge (Phase 8).
- **Content Discovery**: > 60% of users who reach a milestone read the unlocked content (Phases 13–15).

### Business Success (Personal Project)
- **Stability**: Zero maintenance "pagers" — system runs itself.
- **Lore Fidelity**: Zero lore bug reports.
- **Retention**: Active user retention > 30% after 3 months.

### Technical Success
- **Test Coverage**: >90% (backend & UI).
- **Performance**: <1s TTI on 4G networks.
- **Isolation**: 100% data isolation between users; Fellowship features introduce controlled sharing.
- **Asset Budget**: Workers Assets file count < 15k (warn) / < 18k (CI fail) / < 20k (platform hard limit).
- **Offline Read**: Cached UI shell + SWR JSON available when offline.

### Definitions
- **Active user**: Logged at least 1 walk in the trailing 30 days.
- **Reads content**: Opened GoalModal for a milestone (via milestone card click, map waypoint marker, or push notification).

## User Personas

| Persona | Description | Key Need |
|---|---|---|
| Samwise | Casual walker, logs short daily walks | Friction-free logging, narrative reward |
| Bilbo | New user on the couch, needs a push | Zero-friction onboarding, immediate progress feedback |
| Strider | Power user / marathon runner | Data integrity, fast editing, no tool friction |
| Aragorn | Fellowship leader, manages groups | Fair group tracking, moderation controls |
| Gandalf | Admin / developer | Extensibility, AI-assisted workflows |

## User Journeys

### Journey 1 — New User Onboarding (Bilbo)
1. User lands on `/login` → sees "Walk to Mordor" branding.
2. Switches to Register tab → enters username, email, password (strength meter provides feedback).
3. Submits → sees "check your email" confirmation state.
4. Opens confirmation email → clicks link → redirected to `/login?verified=true`.
5. Logs in → redirected to `/journey` (first visit).
6. Sees 0 km total distance, "The Shire" as current milestone, first upcoming goal card.
7. Clicks empty calendar day → DistanceModal opens → logs first walk.
8. **Exit state**: Journey page updates with new total distance; next goal card reflects progress.

### Journey 2 — Daily Walk Logging (Samwise)
1. Returning user opens app → auto-redirected to `/journey` or `/map` (based on preference).
2. **Path A (Journey)**: Clicks today's calendar cell → DistanceModal → enters distance → Save.
3. **Path B (Map)**: Taps floating action button → DistanceModal → enters distance → Save → marker moves on map.
4. Sees updated total distance, current milestone card, and progress toward next goal.
5. If a new milestone is reached → GoalModal fires with milestone image, description, and lore.
6. **Exit state**: Walk logged in < 30 seconds; progress reflected immediately.

### Journey 3 — Fellowship Discovery & Join (Samwise/Aragorn)
1. User navigates to Fellowships via drawer link.
2. **Path A (Invite link)**: Receives shared URL → opens `/party/join/:code` → sees fellowship preview (name, members, mode) → clicks Join → becomes member → redirected to fellowship detail.
3. **Path B (Code entry)**: On `/party`, enters invite code → preview card appears → confirms join.
4. **Path C (Friend invite)**: Sees pending invite badge on Fellowships drawer link → opens `/party` → pending invites section → Accept.
5. Fellowship detail shows: progress bar, member roster with avatars, activity feed, and milestone list.
6. **Exit state**: User is a member; their walked distance contributes to fellowship total.

### Journey 4 — Fellowship Leader Management (Aragorn)
1. Leader creates fellowship on `/party`: name, distance mode (incremental/cumulative), leave behavior.
2. Copies shareable invite link from fellowship detail → shares with friends.
3. Navigates to `/party/:id/manage` to: kick members (with distance removal option), transfer leadership, regenerate invite code, or update settings.
4. On the fellowship detail page: views activity feed (walks + messages), sends messages, monitors member contributions.
5. **Exit state**: Fellowship is configured and active; leader has full moderation control.

### Journey 5 — Map Exploration & Friend Discovery (Samwise/Strider)
1. User navigates to `/map` → sees interactive Middle-earth map with their One Ring marker at current position.
2. Zooms/pans to explore the route; waypoint markers show milestones → clicking one opens GoalModal.
3. Friends appear as avatar markers on the map; hovering shows mini-card with name and distance.
4. Uses PartySelector to switch to fellowship view → map shows all member paths in distinct colors.
5. **Exit state**: User sees their position in context of the full journey, friends, and fellowship members.

## Phased Development & Scope Decisions

### MVP Philosophy
**Experience MVP** — the live version is the MVP core. Polish the solo experience and narrative hook before adding social complexity.

**Resource**: Single developer with AI assistance.

### Phase 1: Polish & Friction Removal ✅ Complete
- Migrated from manual approval to email confirmation for autonomous growth.
- Added intermediary goals to keep gaps < 70 km apart.
- Completed all 171 milestone images (WebP, lazy-loaded).
- Migrated key UI to Preact islands (AuthForms, GoalModal, NextGoalCard, UpcomingGoalCard).

### Phase 2: The Atlas (Visual Immersion) ✅ Complete
- Interactive Konva.js map showing progress line, goal markers, and current position.
- Frontend-heavy; no complex backend changes required.

### Phase 3: The Fellowship (Multiplayer) ✅ Complete
Shipped social layer scope decisions:

- **Multi-party**: Users belong to multiple parties. Journey/Map pages include a party selector.
- **Distance modes**: Leader picks cumulative or incremental at creation (immutable). Leave-distance behavior (keep/remove) is mutable.
- **Leader controls**: Kick with distance-removal override. Transfer leadership without leaving.
- **Party lifecycle**: Empty parties auto-dissolve (soft-delete). Dissolved parties cannot be rejoined.
- **Milestone notifications**: Switching to a party view triggers the milestone modal if the party passed a new goal since last viewed.
- **Avatars**: Predefined LOTR-themed gallery. 64×64 WebP thumbnails under `public/img/avatars/thumbs/`.
- **Friends**: Mutual friend relationships via username search or shareable link. Friends visible on Map as avatars. Badge counts on nav links.
- **Fellowship invites via friends**: Additional join pathway alongside invite-code flow.
- **Fellowship messaging**: Party activity feed with walk logs and text messages, filter UI.
- **Fellowships UI flow**: List → Detail → Management (leader only). Shareable invite links with preview landing page.
- **Races**: Removed from scope. Competitive race functionality is not planned.

### Phase 4+: Expanded Roadmap

The following phases replace the original Phase 4. Each phase builds on prior phases; content phases (13–15) can run in parallel with any phase after Phase 7 ships the milestone card UI.

#### Phase 4: Developer Foundation
*Improve daily DX and establish guardrails before feature work.*
- ESLint setup + legacy JS deprecation linter flagging new code in `public/js/`.
- Merge Vite client build into Wrangler dev pipeline (single terminal, single watch).
- Asset count dashboard in CI — warn at 15k files, fail at 18k.

#### Phase 5: Architecture & Performance
*Internal patterns all subsequent features build on.*
- Unified Preact Signal global store (`appStore.ts`) for session, progress, party state.
- D1 read replica strategy — `db.read()` wrapper for all SELECT queries (zero cost now, enables replicas later).
- Stale-while-revalidate API pattern in Service Worker (first SW enhancement beyond static caching).

#### Phase 6: Journey UX
*Visual, tangible progress that pulls users forward.*
- Milestone-first unlocks — all 171 milestones as locked cards with blurred preview art.
- Persistent journey progress bar component with milestone markers.

#### Phase 7: Stats, Insights & Offline
*Compelling data views and offline-first PWA push.*
- The Palantír — weekly insight orb: distance, pace, projection, fellowship comparison.
- Walk streak & heatmap calendar (GitHub-style contribution grid).
- Year-End Appendices / Walk-to-Mordor Wrapped — Tolkien-style year-in-review + shareable stats.
- Offline write queue with D1 sync — IndexedDB queue in SW, replay on reconnect.

#### Phase 8: Notifications & Re-engagement
*Themed, respectful nudges. Prerequisite: Web Push API infrastructure (VAPID keys, permission flow, subscription management).*
- "One More Mile" push notification — daily distance-to-next-milestone.
- Gandalf's Absence Arc — narrative re-engagement after 3+ inactive days.
- The Dead Marshes — inactive friends sink into marshes on map; tap to encourage.

#### Phase 9: Events & Challenges
*Time-limited stakes and community-scale moments.*
- Nazgûl Pursuit Events — 72-hour personal challenges with cosmetic consequences.
- Community Milestones — global timed challenge with real-time progress bar.

#### Phase 10: AI Narrator
*Personalized daily narration via Workers AI.*
- Workers AI generates journey narration from distance, weather, streak data.
- Prompt engineering, rate limiting, and cached generated text.

#### Phase 11: Social Mechanics
*Resource-sharing fellowship dynamics.*
- Distance Lending / Shadowfax Express — gift surplus km to a struggling companion (caps, cooldowns).

#### Phase 12: Advanced Social
*Cross-fellowship interactions. Depends on event engine from Phase 9.*
- Cross-Fellowship Alliances — temporary alliance between two parties for mega-challenges.

#### Phases 13–15: Milestone Content (Waves 1–3)
*Rich content at milestones. Parallelizable after Phase 6 ships milestone card UI.*
- Wave 1: Campfire Stories (150-word lore snippets), Poetry Anthology, Appendices Deep Dives.
- Wave 2: Field Guide to Middle-earth Flora & Fauna (illustrated naturalist's sketchbook).
- Wave 3: Campfire Stories — Milestone Journals (user-written entries visible to friends).

### Deferred Indefinitely
- Alternative narrative arcs (Aragorn, Boromir, The Hobbit) — massive non-technical content effort.
- "Split party" logistics for members on different routes.

### Risk Mitigation
- **Scope creep**: Atlas (visuals) shipped before Fellowship (data) to avoid building "Live Multiplayer Map" all at once.
- **Content volume**: Narrative arcs deferred until platform features are complete.
- **Phase dependencies**: Architecture (Phase 5) and SWR pattern must ship before offline write queue (Phase 7). Content waves depend on milestone card UI (Phase 6).

## Explicitly Out of Scope

| Item | Reason |
|---|---|
| R2 for image storage | Static assets in `public/img` + `image_id` are sufficient; no R2 for now. |
| Competitive races | Removed from scope; social layer covers fellowships, friends, avatars. |
| GPS / wearable integration | Manual distance entry only. Long-term design decision consistent with Samwise persona. |
| IE11 support | Not supported. |
| Alternative narrative arcs | Deferred indefinitely — massive non-technical content sourcing effort. |

## Non-Functional Targets

| Category | Requirement |
|---|---|
| TTI | Add Walk modal ready in < 500 ms on 4G |
| Calendar render | < 200 ms to prevent UI stutter |
| Image assets | WebP, < 500 KB each, 25 MB hard limit per file |
| Asset budget | Workers Assets < 15k files (warn) / < 20k (hard limit) |
| Passwords | Salted + hashed (PBKDF2 or Argon2) |
| IDOR prevention | Session ownership validated on every API request |
| Privacy default | All user data private; sharing requires explicit opt-in |
| Accessibility | WCAG AA contrast; 44×44 px minimum touch targets |
| Responsive | Mobile portrait first; desktop centered/padded |
| Push notifications | Delivered < 30 s from trigger event (Phase 8) |
| AI narration | Generated < 5 s; cached response thereafter (Phase 10) |
| Offline read | Cached UI shell + SWR JSON available when offline (Phase 5) |

## Content Compliance (Lore Rules)

- Content must adhere strictly to Tolkien's universe. Verify references against the books.
- Distance determines the narrative point. Users are **not** time-locked or skipped ahead.
- Lore description updates must follow the `goal-description-update` verification standard.
- Asset strategy: Workers Assets binding for static WebP images committed to the repo.
