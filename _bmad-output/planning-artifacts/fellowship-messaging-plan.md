# Fellowship Messaging Feature — Implementation Plan

## Overview

Add free-text messaging (≤200 characters) to fellowship activity feeds. Messages appear alongside walk logs in a unified activity feed that supports filtering by type (walks, messages, or both).

## Architecture Decisions

1. **Unified Activity Feed**: Rather than separate endpoints, extend `GET /api/party/:id/activity` to return both walk logs and messages in a single, chronologically-ordered feed. Each item has a `type` field (`'walk'` or `'message'`).
2. **Single New Endpoint**: `POST /api/party/:id/messages` for sending messages.
3. **Filter via Query Parameter**: `?type=all|walk|message` on the existing activity endpoint (default: `all`).
4. **200-character limit** enforced server-side with validation.
5. **Increased feed limit**: From 10 to 20 items to accommodate mixed content.

## Changes

### 1. Database Migration (`migrations/0124_create_party_messages.sql`)

- Create `party_messages` table: `id`, `party_id`, `user_id`, `content` (TEXT, max 200 chars), `created_at` (DATETIME).
- Foreign keys to `parties` and `users`.
- Index on `(party_id, created_at)` for feed queries.

### 2. Backend API (`src/party-handlers.ts`)

- **New handler**: `handleSendPartyMessage(request, env, partyId)` — validates auth, membership, content (1–200 chars trimmed), inserts into `party_messages`, returns created message.
- **Modified handler**: `handlePartyActivity` — accepts `?type=all|walk|message` filter. Uses UNION ALL query for combined feed, or individual queries when filtered. Returns items with `type` field.
- **New interface**: `PartyMessageRow` for D1 result typing.
- **Updated interface**: `ActivityLogRow` → unified type with `type` discriminator.

### 3. Route Registration (`src/index.ts`)

- Add `POST /api/party/:id/messages` route before the leave route.
- Import `handleSendPartyMessage` from party-handlers.

### 4. Frontend Component (`client/src/components/ActivityFeed.tsx`)

- **Updated `ActivityItem` interface**: Add `type`, `content`, `message_id` fields; make `distance`/`date` optional.
- **Message input form**: Textarea (200 char limit) + character counter + send button at top of feed.
- **Filter UI**: Dropdown select or button group above the feed (All / Walks / Messages).
- **Render logic**: Different rendering for walk vs message items.
- **Optimistic update**: After sending a message, prepend it to the feed immediately.

### 5. Styling (`public/css/party.css`)

- Message input form styles (`.party-message-form`).
- Message activity item styles (`.party-activity-item--message`).
- Filter control styles (`.party-activity-filter`).
- Character counter styles.

### 6. Tests

#### Backend Tests (`tests/api/party-progress.test.ts`)
- `handleSendPartyMessage`: auth, membership, validation (empty, too long, whitespace-only), success, DB error.
- Updated `handlePartyActivity` tests: mixed feed, filter parameter, type field in responses.

#### Frontend Tests (`client/src/components/ActivityFeed.test.tsx`)
- Message rendering (different from walk items).
- Message input form (character limit, submission).
- Filter functionality.
- Optimistic update after sending.

## Implementation Order

1. Database migration
2. Backend handler (send message)
3. Backend handler (update activity to unified feed)
4. Route registration
5. Frontend: ActivityFeed updates (unified rendering, filter, message input)
6. CSS styling
7. Backend tests
8. Frontend tests
