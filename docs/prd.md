---
name: prd
description: Product requirements document — features, user stories, and product scope decisions.
updated: 2026-03-17
---

# Product Requirements Document

## Product Vision

Walk to Mordor is a gamified fitness tracking PWA that maps daily walking/running to the 6,425 km quest from the Shire to Mount Doom (and back). It solves exercise boredom by providing narrative context, visual progress tracking, and long-term motivation for Lord of the Rings fans of all fitness levels.

## Success Criteria

### User Success
- **Routine Formation**: Uses app 2–3 times/week consistently.
- **Immersion**: Reads milestone descriptions.
- **Accessibility**: Log a walk in under 30 seconds on mobile.

### Business Success (Personal Project)
- **Stability**: Zero maintenance "pagers" — system runs itself.
- **Lore Fidelity**: Zero lore bug reports.
- **Retention**: Active user retention > 30% after 3 months.

### Technical Success
- **Test Coverage**: >90% (backend & UI).
- **Performance**: <1s TTI on 4G networks.
- **Isolation**: 100% data isolation between users, **until** Fellowship features introduce controlled sharing.

## User Personas

| Persona | Description | Key Need |
|---|---|---|
| Samwise | Casual walker, logs short daily walks | Friction-free logging, narrative reward |
| Bilbo | New user on the couch, needs a push | Zero-friction onboarding, immediate progress feedback |
| Strider | Power user / marathon runner | Data integrity, fast editing, no tool friction |
| Aragorn | Fellowship leader, manages groups | Fair group tracking, moderation controls |
| Gandalf | Admin / developer | Extensibility, AI-assisted workflows |

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

### Phase 3: The Fellowship (Multiplayer)
Key scope decisions for the social layer:

- **Multi-party**: Users can belong to multiple parties. Journey/Map pages include a party selector.
- **Distance modes**: Leader picks cumulative or incremental at creation — **immutable** after that. Leave-distance behavior (keep/remove) is mutable.
- **Leader controls**: Kick with distance-removal override. Transfer leadership without leaving.
- **Party lifecycle**: Empty parties auto-dissolve (soft-delete). Dissolved parties cannot be rejoined.
- **Milestone notifications**: Switching to a party view triggers the milestone modal if the party passed a new goal since last viewed.
- **Avatars**: Predefined LOTR-themed gallery. 64×64 WebP thumbnails under `public/img/avatars/thumbs/`.
- **Friends**: Mutual friend relationships via username search or shareable link. Friends visible on Map as avatars. Badge counts on nav links.
- **Fellowship invites via friends**: Additional join pathway alongside invite-code flow. Both remain functional.
- **Races**: **Removed from roadmap.** Competitive race functionality is not planned.
- **Fellowships UI flow**: List → Detail → Management (leader only). Shareable invite links with preview landing page.

### Phase 4: Expansion (Content Scale) — Deferred
- Alternative narrative arcs (Aragorn, Boromir, The Hobbit).
- "Split party" logistics for members on different routes.
- Deferred because content sourcing for 8+ storylines is a massive non-technical effort.

### Risk Mitigation
- **Scope creep**: Atlas (visuals) shipped before Fellowship (data) to avoid building "Live Multiplayer Map" all at once.
- **Content volume**: Phase 4 deferred until platform features are complete.

## Explicitly Out of Scope

| Item | Reason |
|---|---|
| R2 for image storage | Static assets in `public/img` + `image_id` are sufficient; no R2 for now. |
| Competitive races | Removed from Phase 3; social layer covers fellowships, friends, avatars. |
| Offline write sync | Online-first. Show "You are offline" instead of background sync queues. |
| GPS integration | Manual distance entry only (consistent with Samwise persona). |
| IE11 support | Not supported. |
| Complex background sync | Service Worker caches UI shell only; data requires network. |

## Non-Functional Targets

| Category | Requirement |
|---|---|
| TTI | Add Walk modal ready in < 500 ms on 4G |
| Calendar render | < 200 ms to prevent UI stutter |
| Image assets | WebP, < 500 KB each, 25 MB hard limit per file |
| Passwords | Salted + hashed (PBKDF2 or Argon2) |
| IDOR prevention | Session ownership validated on every API request |
| Privacy default | All user data private; sharing requires explicit opt-in |
| Accessibility | WCAG AA contrast; 44×44 px minimum touch targets |
| Responsive | Mobile portrait first; desktop centered/padded |

## Content Compliance (Lore Rules)

- Content must adhere strictly to Tolkien's universe. Verify references against the books.
- Distance determines the narrative point. Users are **not** time-locked or skipped ahead.
- Lore description updates must follow the `goal-description-update` verification standard.
- Asset strategy: Workers Assets binding for static WebP images committed to the repo.
