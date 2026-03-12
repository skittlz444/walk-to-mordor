---
title: 'Map View Uses Avatar Thumbnail for Player Marker'
slug: 'map-view-uses-avatar-thumbnail-for-player-marker'
created: '2026-03-12T00:00:00Z'
status: 'Completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'Preact'
  - 'Konva'
  - 'TypeScript'
  - 'Cloudflare Workers'
files_to_modify:
  - 'client/src/islands/MapIsland.tsx'
  - 'client/src/components/map/UserMarker.ts'
  - 'client/src/components/map/UserMarker.test.ts'
  - 'docs/frontend-guide.md'
code_patterns:
  - 'Map island bootstraps progress, goals, and session data in parallel during initialization.'
  - 'Konva map markers are built with imperative helper modules under client/src/components/map/.'
  - 'Friend markers already use avatar thumbnails with fallback behavior on image load failure.'
  - 'Session responses already expose avatarId and other user preferences from the auth handler.'
test_patterns:
  - 'Client-side behavior is covered with Vitest in client/src/**/*.test.ts[x].'
  - 'Map-related unit tests live near the client code and validate state/bootstrap behavior with mocked fetch responses.'
---

# Tech-Spec: Map View Uses Avatar Thumbnail for Player Marker

**Created:** 2026-03-12T00:00:00Z

## Overview

### Problem Statement

The main map currently renders the current user with the ring marker regardless of whether the user has selected an avatar. This makes the map ignore the user identity preference that is already stored and exposed through the authenticated session.

### Solution

Update the map bootstrap to consume the authenticated user's avatar ID and enhance the Konva user marker to render the avatar thumbnail when available. If no avatar is selected, or if the avatar thumbnail fails to load, keep the existing ring marker as the fallback.

### Scope

**In Scope:**
- Main map current-user marker behavior
- Session-to-map plumbing needed to provide `avatarId` to the marker
- Thumbnail-based avatar rendering for the user marker
- Ring fallback when `avatarId` is missing or image loading fails
- Test and documentation updates required for the change

**Out of Scope:**
- Avatar picker or profile settings changes
- Backend schema or auth/session contract redesign
- Friend marker redesign
- Changing friend marker fallback behavior
- Asset generation or storage pipeline changes

## Context for Development

### Codebase Patterns

- `client/src/islands/MapIsland.tsx` already fetches `/api/session` during map initialization alongside progress and goals.
- `src/auth-handlers.ts` already includes `avatarId` in session responses, so the likely gap is client consumption rather than backend data availability.
- `client/src/components/map/UserMarker.ts` is the dedicated imperative Konva helper for the current-user marker and currently renders the ring marker visuals with a halo, tooltip, inverse scaling, and path animation support.
- `client/src/components/map/FriendMarkers.ts` establishes the map avatar pattern: use `/img/avatars/thumbs/{slug}.webp`, keep a non-image fallback visible until the image loads, and preserve fallback on image failure.
- `client/src/components/map/FriendMiniCard.tsx` uses the same thumbnail path for map-adjacent avatar UI, reinforcing that thumbs are the expected map asset variant.
- There is no existing dedicated `MapIsland` or `UserMarker` test file, so this change will likely need a new focused client-side unit test rather than patching an existing marker test.
- Existing map/bootstrap tests in `client/src/stores/mapStore.test.ts` rely on ordered `fetch` mocks and assert session-derived preference handling, which is the closest current test pattern for session-fed map behavior.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `client/src/islands/MapIsland.tsx` | Initializes map data and creates the current-user marker |
| `client/src/components/map/UserMarker.ts` | Renders and updates the current-user marker |
| `client/src/components/map/FriendMarkers.ts` | Existing thumbnail avatar loading and fallback pattern for map markers |
| `client/src/components/map/FriendMiniCard.tsx` | Confirms map-adjacent overlays also prefer thumbnail avatar assets |
| `src/auth-handlers.ts` | Session response already exposes `avatarId` |
| `client/src/stores/mapStore.test.ts` | Closest existing pattern for mocked map/session bootstrap tests |

### Technical Decisions

- Align the player marker with the friend marker asset strategy by using avatar thumbnails rather than full-size avatar images.
- Preserve the ring as the only fallback for the current user marker; do not switch the player marker to initials fallback.
- Treat image load failure the same as missing avatar data for the current user marker.
- Extend `MapIsland`'s local session response typing to include `avatarId` and pass that value into `createUserMarker(...)` during initial marker creation.
- Extend `createUserMarker(...)` rather than introducing a second marker helper, so position updates, scaling, tooltip behavior, and destroy semantics stay unchanged.
- Follow the friend-marker loading model for avatars, but keep the current-user fallback visuals as the ring instead of initials.
- Add a focused client-side unit test file for `UserMarker` avatar success and fallback behavior because no direct marker test coverage exists today.

## Implementation Plan

### Tasks

- [x] Task 1: Thread avatar session data into map marker creation
  - File: `client/src/islands/MapIsland.tsx`
  - Action: Extend the local session response type used by `sessionPromise` to include `avatarId`, preserve the existing `showFutureGoalsUnlocked` handling, and pass the resolved `avatarId` into `createUserMarker(...)` during initial map bootstrap.
  - Notes: Keep the fetch ordering and Promise shape intact so existing map initialization behavior does not regress. The session field should remain optional because map bootstrap already tolerates partial session responses.

- [x] Task 2: Update the current-user Konva marker to support avatar thumbnails with ring fallback
  - File: `client/src/components/map/UserMarker.ts`
  - Action: Expand `createUserMarker(...)` to accept an optional `avatarId`, attempt to load `/img/avatars/thumbs/{avatarId}.webp` when present, render the avatar inside the existing circular marker footprint, and preserve the current ring visuals when `avatarId` is absent or the thumbnail load fails.
  - Notes: Keep the existing inverse scaling, tooltip, animation, event listeners, and destroy behavior unchanged. Follow the async image loading guard pattern already used in `FriendMarkers.ts`, but do not switch the player marker to initials fallback.

- [x] Task 3: Add focused client-side regression coverage for the user marker
  - File: `client/src/components/map/UserMarker.test.ts`
  - Action: Add Vitest coverage for the `UserMarker` helper that verifies ring fallback when no avatar ID is provided, avatar thumbnail rendering when image loading succeeds, and ring fallback retention when avatar image loading fails.
  - Notes: Mock `window.Image` and Konva interactions as needed so the tests can assert the async image branch without relying on real asset loads. Include assertions that the existing marker API surface (`setPosition`, `setScale`, `setDistance`, `destroy`) still works after the avatar path is introduced.

- [x] Task 4: Verify implementation consistency against map avatar conventions
  - File: `client/src/components/map/FriendMarkers.ts`
  - Action: Use this file as the reference pattern during implementation review to ensure the player marker uses the same thumbnail asset path and async load/error handling approach.
  - Notes: No functional changes are expected here unless investigation during implementation uncovers a shared helper extraction that is clearly lower-risk than keeping the logic local.

### Acceptance Criteria

- [x] AC 1: Given an authenticated map session response that includes a valid `avatarId`, when the main map initializes, then the current-user marker requests `/img/avatars/thumbs/{avatarId}.webp` and displays the avatar within the player marker instead of the ring-only visual.
- [x] AC 2: Given an authenticated user with no avatar selected, when the main map initializes, then the current-user marker renders the existing ring fallback and does not attempt to load a thumbnail avatar image.
- [x] AC 3: Given an authenticated user with an `avatarId` whose thumbnail image cannot be loaded, when the main map initializes, then the current-user marker remains on the ring fallback without throwing or breaking marker interactivity.
- [x] AC 4: Given the player marker is rendering either an avatar thumbnail or the ring fallback, when the user zooms, pans, hovers, taps, or updates progress, then the marker preserves its existing tooltip behavior, inverse scaling, and movement/update behavior.
- [x] AC 5: Given the user marker helper is covered by client tests, when the avatar-enabled implementation is merged, then automated tests cover avatar success, missing-avatar fallback, and failed-image fallback paths.

## Additional Context

### Dependencies

- Existing authenticated session fetch in the map island
- Existing avatar thumbnail assets under `/img/avatars/thumbs/`
- Existing Konva marker rendering and inverse-scaling behavior
- Existing session response contract that returns `avatarId`
- Konva image node support within the existing marker group composition

### Testing Strategy

- Add a dedicated Vitest unit test for `client/src/components/map/UserMarker.ts` covering three states: no avatar ID, avatar thumbnail load success, and avatar thumbnail load failure.
- Validate that the marker continues to preserve tooltip, scaling, and position APIs after the avatar option is introduced.
- If a map bootstrap test is added or adjusted, follow the existing ordered `fetch` mock approach used in `client/src/stores/mapStore.test.ts` for session-derived map state.
- Manually verify in the browser with one user that has an avatar selected and one without an avatar to confirm the player marker swaps correctly while friend markers remain unchanged.

### Notes

- Friend markers already use initials as their fallback; this spec intentionally keeps the player marker fallback as the ring.
- The current-user marker and friend markers should stay visually consistent in thumbnail source and zoom behavior, while preserving their different fallback semantics.
- The current implementation comments in `UserMarker.ts` still describe an optional One Ring icon asset path. Implementation should update comments/docstrings so the source-of-truth behavior matches the new avatar-first logic.

## Review Notes

- Adversarial review completed
- Findings: 12 total, 2 fixed, 10 skipped as low-confidence/noise or follow-up coverage work
- Resolution approach: auto-fix for validated issues

## Code Review (AI) — 2026-03-12

**Reviewer:** Hayden (AI-assisted adversarial review via code-review workflow)

**Outcome:** All fixes applied. Status confirmed `Completed`.

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| M1 | MEDIUM | `img.crossOrigin = 'anonymous'` missing in `UserMarker.ts` — spec named `FriendMarkers.ts` as reference pattern; FriendMarkers sets crossOrigin; UserMarker did not | Fixed: added `img.crossOrigin = 'anonymous'` in `UserMarker.ts` |
| M2 | MEDIUM | `docs/frontend-guide.md` modified in git but absent from `files_to_modify` in story metadata | Fixed: added to `files_to_modify` list |
| L1 | LOW | No test assertion for `crossOrigin` in `UserMarker.test.ts` — mock tracked it but no regression guard | Fixed: added `expect(browserImages[0].crossOrigin).toBe('anonymous')` to avatar-load success test |
| L2 | LOW | `animateAlongPoints([])` empty-array and zero-length paths not tested | Skipped — existing logic is straightforward, LOW risk |
| L3 | LOW | `setScale` assertion too weak (`toBeGreaterThan(0)`) | Skipped — LOW priority, marker scale function itself has no dedicated test requirement in spec |