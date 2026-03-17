# Refined Shortlist — Priority Ideas

**Source:** brainstorming-shortlist-2026-03-16.md
**Date:** March 17, 2026
**Total:** 26 ideas (28 selected, 2 merged pairs)

---

## Notifications & Re-engagement (4 ideas)

- [5] 13. **Gandalf's Absence Arc** — After 3+ inactive days, trigger a narrative: "Gandalf has ridden ahead to investigate…" When the user returns, welcome them back with story continuity, not shame. *(Persona: Bilbo)*

- [4] 5. **The Palantír — Weekly Insight Orb** — Every Sunday, show a "vision" summary: distance walked, pace vs. last week, projected arrival date, fellowship average comparison. One glanceable card. *(Persona: Strider)*

- [5] 53. **The Dead Marshes — Reactivation Pings** — When a friend goes inactive for 7+ days, their avatar sinks into the Dead Marshes on YOUR map. Tap their ghostly face to send themed encouragement. *(Ecosystem Thinking)*

- [5] 140. **The "One More Mile" Push Notification** — Single daily notification: "You're 1.2 miles from Weathertop. One more walk today?" Perfectly timed, devastatingly effective. *(Anti-Solution)*

---

## Milestone Content & Lore (5 ideas)

- [10] 15. **Campfire Stories** — At certain milestones, unlock short lore snippets (150 words) about the location: Tolkien facts, book quotes, movie trivia. Collectible knowledge library. *(Persona: Samwise)*

- [12] 49. **Campfire Stories — Milestone Journals** — At each milestone, leave a short text/emoji "journal entry" visible to friends and party members. Read entries from those who passed before you. *(Cross-Pollination: trail registers)*

- [11] 70. **Field Guide to Middle-earth Flora & Fauna** — Illustrated "field notes" on athelas, mallorn trees, oliphaunts — presented as a naturalist's sketchbook. *(Concept Blending)*

- [10] 71. **Poetry Anthology: Songs of the Road** — Unlock actual poems and songs from the books at the milestones where they were sung. *(Concept Blending)*

- [10] 86. **The Appendices Deep Dives** — Flag milestones where Tolkien's Appendices provide extra context and surface that material — genealogies, calendar conversions, linguistic notes. *(Analogical Thinking)*

---

## Events & Challenges (3 ideas)

- [6] 11. **Nazgûl Pursuit Events** — Time-limited events (72 hours): "A Nazgûl rides behind you — walk 15 km in 3 days to escape." Failure = cosmetic "shadow" on your avatar for a week. *(SCAMPER: Adapt)*

- [9] 58. **Cross-Fellowship Alliances** — Two parties form a temporary alliance for a mega-challenge. Combined distance, shared chat channel for the duration. Dissolves after the event. *(Ecosystem Thinking)*

- [6] 60. **Community Milestones — Global Events** — Time-limited community events: "Can the entire user base collectively walk from Shire to Mordor in one weekend?" Real-time global progress bar. *(Cross-Pollination)*

---

## Year-End Recap (merged #31 + #134)

- [4] 31/134. **Year-End Appendices / Walk-to-Mordor Wrapped** — December generates a "Red Book Appendix" year in review: total distance, longest streak, milestones reached, fellowship stats. Rendered as a printable PDF and a Spotify Wrapped-style shareable stats page. Designed for screenshotting and social sharing. *(Persona: Strider + Pirate Code: Spotify Wrapped)*

---

## Distance Gifting (merged #28 + #59)

- [8] 28/59. **Distance Lending / Shadowfax Express** — Fellowship members can gift surplus km to a struggling companion. Framed as "Sam carrying Frodo" or Shadowfax carrying them forward on the map. Capped at 10% weekly total or 1 km/week. *(SCAMPER: Modify + Ecosystem Thinking)*

---

## AI Narrator

- [7] 17. **AI Narrator** — Workers AI generates personalized daily narration of your journey based on actual distance, weather, streak status. "You trudged 3.2 km through morning mist near Bree…" *(What-If)*

---

## UX & Dashboard (3 ideas)

- [3] 7. **Milestone-First Unlocks** — Show ALL 171 milestones upfront as locked cards with blurred preview art. Users see exactly what's coming and feel the pull of "just 12 more km to Weathertop." *(Reversal)*

- [3] 89. **Journey Progress Bar Component** — Persistent Preact progress bar on the journey page showing percentage with milestone markers. Replaces "big number vs bigger number" with visual progress. *(First Principles)*

- [4] 108. **Walk Streak & Heatmap Calendar** — GitHub-style contribution heatmap on profile/dashboard. Data already exists in the progress table. *(Green Hat)*

---

## Architecture & Performance (5 ideas)

- [2] 93. **Offline Write Queue with D1 Sync** — IndexedDB write queue in service worker for walk entries. On reconnect, replay POSTs. Transforms PWA from offline-read to offline-first. *(SCAMPER: Adapt)*

- [2] 95. **Unified Island Bootstrap** — Single `hydrateIslands()` entry scanning `[data-island]` attributes and lazy-loading Preact components. Standardizes the legacy/island boundary. *(SCAMPER: Combine)*

- [2] 100. **Preact Signal Global Store** — Single `appStore.ts` using Preact Signals for session, progress, and party state. All islands subscribe to the same signals. *(SCAMPER: Substitute)*

- [1] 101. **D1 Read Replica Strategy** — Structure all reads through a `db.read()` wrapper so read replicas are a config flip away. Zero cost now, massive payoff later. *(Failure Analysis)*

- [2] 102. **Stale-While-Revalidate API Pattern** — Return cached JSON from SW for progress/session while revalidating in background. Perceived performance = instant. *(SCAMPER: Adapt)*

---

## Developer Experience & CI (3 ideas)

- [1] 99. **Legacy JS Deprecation Linter** — ESLint rule or CI check that flags new code in `public/js/`. Ratchets against expanding the legacy surface. *(Blue Hat)*

- [1] 106. **Eliminate Dual Build Watching** — Merge Vite client build into Wrangler's dev pipeline. One terminal, one watch process. *(SCAMPER: Eliminate)*

- [1] 114. **Asset Count Dashboard in CI** — Log total file count under `public/` in each build. Warn at 15k, fail at 18k. *(Constraint Mapping)*
