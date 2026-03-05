# Story 3.8: Fellowship Progress Activity Feed

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a User who belongs to a Fellowship,
I want to see a feed of recent walking activities from my party members,
so that I can stay motivated and see how others are contributing to our shared journey.

## Acceptance Criteria

1. Display the last 10 party member activities on the Fellowship detail page (`/party/:id`).
2. Fetch data using the `GET /api/party/:id/activity` endpoint (created in Story 3.4).
3. Format each activity entry clearly, e.g., "[Member] walked [X] km on [Date]".
4. Auto-refresh the feed every 60 seconds or on page focus to keep it current.
5. Visually distinguish the user's own activities from those of other members.
6. Show a "No recent activity" placeholder when the feed is empty.
7. Ensure privacy: The feed is only visible to active party members (enforced by the API, but UI should handle potential 403 errors gracefully).

## Tasks / Subtasks

- [x] Task 1: Activity Feed Component (AC: 1, 2, 3, 5, 6)
  - [x] Create `ActivityFeed.tsx` component in `client/src/components/`.
  - [x] Implement fetching logic using `GET /api/party/:id/activity`.
  - [x] Render the list of activities with appropriate formatting.
  - [x] Add visual distinction for the current user's activities (e.g., "You walked...").
  - [x] Implement empty state UI.
- [x] Task 2: Auto-refresh Logic (AC: 4)
  - [x] Implement `setInterval` for 60-second polling.
  - [x] Add event listener for `visibilitychange` to refresh on page focus.
  - [x] Ensure cleanup of intervals and listeners on component unmount.
- [x] Task 3: Integration & Error Handling (AC: 1, 7)
  - [x] Integrate `ActivityFeed` into `PartyDetailIsland.tsx` (from Story 3.7).
  - [x] Handle API errors (e.g., 403 if kicked) by displaying an appropriate message or hiding the feed.

## Dev Notes

- **Architecture Details**: 
  - The API endpoint `GET /api/party/:id/activity` was defined in Story 3.4.
  - The `ActivityFeed` component should be a child of `PartyDetailIsland`.
- **Polling**: Use `setInterval` for polling, but ensure it's cleared on component unmount. Also, consider using the Page Visibility API to pause polling when the tab is not active.
- **Date Formatting**: Use a consistent date format (e.g., "Today", "Yesterday", or "MMM D").

### Project Structure Notes

- New components go in `client/src/components/`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.8: Fellowship Progress Activity Feed]
- [Source: docs/architecture.md#ADR-004: Fellowship Data Model Direction]
- [Source: docs/ux-design.md]

### change-impact

Requirements expanded from original spec:
- Activity feed now lives on the Fellowship detail page (`/party/:id`) instead of a generic "currently selected party" context.
- Depends on Story 3.4 for the `GET /api/party/:id/activity` endpoint and walk-logging → `party_progress_log` integration.
- Still scoped per-party.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Created ActivityFeed Preact component with fetch, auto-refresh (60s polling + visibilitychange), date formatting (Today/Yesterday/MMM D), own-activity highlighting
- Integrated into PartyDetailIsland replacing placeholder
- Added current_user_id to party progress API response for client-side user identification
- Added CSS styles for activity feed items with own-activity visual distinction
- 10 new client tests covering all acceptance criteria

### File List

- client/src/components/ActivityFeed.tsx (NEW)
- client/src/components/ActivityFeed.test.tsx (NEW)
- client/src/islands/PartyDetailIsland.tsx (MODIFIED)
- src/party-handlers.ts (MODIFIED)
- public/css/party.css (MODIFIED)

## Change Log

| Date | Summary |
|------|---------|
| 2026-03-03 | Implemented activity feed component, integration, auto-refresh, tests |
