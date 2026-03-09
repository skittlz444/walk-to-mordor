WALK TO MORDOR - AVATAR UI IMPLEMENTATION GUIDE
===============================================

1. AVATAR CONFIGURATION (src/avatar-slugs.ts)
=============================================

VALID_AVATAR_SLUGS array with 22 LOTR characters:
- aragorn, arwen, bilbo, boromir, elrond, eowyn, faramir, frodo
- galadriel, gandalf-grey, gandalf-white, gimli, gollum, legolas, merry
- pippin, samwise, saruman, sauron, theoden, tom-bombadil, treebeard

Type: AvatarSlug (discriminated union of valid slugs)
Function: isValidAvatarSlug(slug: string): slug is AvatarSlug

Image Paths:
- Full: /img/avatars/{slug}.webp
- Thumbs: /img/avatars/thumbs/{slug}.webp (32x32)

All 44 files (22 full + 22 thumbs) exist as placeholders.


2. COMPONENT DIRECTORY
======================
client/src/components/
- ActivityFeed.tsx (+ test)
- admin/ (subdirectory)
- map/ (subdirectory)


3. ISLAND COMPONENTS WITH AVATARS
==================================

FriendsListIsland.tsx (Lines 44-61)
-----------------------------------
InlineAvatar Component:
- Props: username, avatarId, size (default 32px)
- If avatarId exists: Show <img src="/img/avatars/{avatarId}.webp" />
- Fallback: Colored initials using getAvatarBg(username)
  getAvatarBg = hsl((charCode * 137) % 360, 50%, 35%)
- Uses friend-avatar and friend-avatar--initials CSS classes
- Used in: pending requests (296), search (348), friends list (390)


FriendProfileIsland.tsx (Lines 31-47)
--------------------------------------
Same InlineAvatar pattern but size=128px default
Large avatar display on friend profile header
Uses friend-avatar--large CSS class


FriendAddIsland.tsx (Lines 23-39)
----------------------------------
Same InlineAvatar pattern, size=128px
Shows avatar preview when accepting friend link


PartyDetailIsland.tsx
---------------------
No avatar display - uses getMemberColor(color) for member identification
Has friend action buttons for non-friends


PartyManageIsland.tsx
---------------------
No avatar display


DrawerIsland.tsx
-----------------
No avatar display - navigation only


4. BACKEND AUTHENTICATION (src/auth-handlers.ts)
================================================

handleSessionValidation (Lines 234-330)
----------------------------------------
Location: POST /api/session (likely, needs route check)
Returns:
{
  userId: number,
  username: string,
  email: string,
  showFutureGoalsUnlocked: boolean,
  defaultViewMap: boolean,
  isAdmin: boolean,
  expiresAt: string
}
Database Query:
SELECT s.id, s.expires_at, u.id as user_id, u.username, u.email, u.approved,
  u.show_future_goals_unlocked, u.default_view_map, u.is_admin
FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ?

NOTE: No avatar_id returned. Add to response when implementing.


handleUpdatePreferences (Lines 573-627)
----------------------------------------
Endpoint: PUT /api/user/preferences
Method: Validates session, updates user preferences
Body: { showFutureGoalsUnlocked?: boolean, defaultViewMap?: boolean }
Pattern: At least one field required, validates types, updates DB with timestamp
Returns: Updated preferences as response object

TEMPLATE for handleUpdateAvatar:
- Validate avatar slug with isValidAvatarSlug()
- Update users.avatar_id
- Return success


5. ROUTE REGISTRATION PATTERN (src/index.ts)
=============================================
Simple routes:
if (url.pathname === "/api/path" && method === "METHOD") {
  return handleFunction(request, env, body);
}

Parameterized routes using matchRoute utility:
const params = matchRoute(url.pathname, '/api/path/:paramName');
if (params && method === "POST") {
  const value = Number.parseInt(params.paramName, 10);
  if (!Number.isInteger(value)) return createErrorResponse(...);
  return handleFunction(request, env, body, value);
}

For avatar update endpoint:
if (url.pathname === "/api/user/avatar" && method === "PUT") {
  return handleUpdateAvatar(request, env, body);
}


6. TYPESCRIPT CONFIGURATION
============================

client/tsconfig.json:
- target: ES2020
- jsx: react-jsx with jsxImportSource: "preact"
- strict: true (no unused vars/params)
- moduleResolution: "bundler"

Root tsconfig.json (Cloudflare Workers):
- target: esnext
- module: esnext
- strict: true


7. VITE BUILD CONFIG (client/vite.config.ts)
==============================================
- Plugin: @preact/preset-vite
- Input: ./src/index.tsx
- Output: ../public/js/client/islands.js
- Islands architecture (single entry point)


8. VITEST TEST PATTERNS
=======================
Location: client/src/**/*.test.tsx

Setup Pattern:
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/preact';

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() });
});

afterEach(() => {
  vi.restoreAllMocks();
});


9. PUBLIC JS - PROFILE.JS
==========================
/public/js/profile.js (257 lines)

Key functions:
- showProfileModal() - Creates modal with profile form
- handleSaveProfile() - PUT /api/profile with { username, email }
- savePreference(toggle, key, value) - PUT /api/user/preferences with preference
- handleLogoutFromModal() - Calls window.logout()

Endpoints used:
- GET /api/session - Fetch current user info
- PUT /api/profile - Update username/email
- PUT /api/user/preferences - Update preferences

NOTE: No avatar selection UI currently. This is where avatar picker would be added.


10. AVATAR STORAGE
==================

Database Field: users.avatar_id (VARCHAR, nullable)
Examples: 'aragorn', 'frodo', null

Frontend Usage Pattern:
interface Profile {
  avatar_id: string | null;
  username: string;
  ...
}

Component receives avatar_id and passes to InlineAvatar:
<InlineAvatar username={user.username} avatarId={user.avatar_id} />


11. IMPLEMENTATION CHECKLIST
============================

Backend:
[ ] Add avatar_id field to session response (handleSessionValidation)
[ ] Create handleUpdateAvatar function in auth-handlers.ts
[ ] Register PUT /api/user/avatar route in index.ts
[ ] Validate avatar slug with isValidAvatarSlug()
[ ] Update users.avatar_id in database

Frontend:
[ ] Create AvatarPicker.tsx component in client/src/components/
[ ] Import VALID_AVATAR_SLUGS from avatar-slugs.ts
[ ] Display grid of avatar thumbnails
[ ] Add avatar section to profile modal (public/js/profile.js)
[ ] Call PUT /api/user/avatar endpoint on selection
[ ] Display current avatar on profile page

Testing:
[ ] Add AvatarPicker.test.tsx with vitest
[ ] Test all 22 avatars render
[ ] Test selection callback fires
[ ] Mock fetch for API call
[ ] Add avatar to FriendProfileIsland tests (if not already)

Assets:
[ ] Verify all 44 WebP files exist
[ ] Replace placeholder images with watercolor-style avatars
[ ] Optimize WebP compression
