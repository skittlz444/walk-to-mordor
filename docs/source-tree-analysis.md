# Source Tree Analysis

Last updated: 2026-03-14

## High-Level Tree

```text
walk-to-mordor/
  src/                  # Worker entry, route dispatch, API handlers, SSR renderers (31 files)
  client/               # Preact islands app (Vite + Vitest)
    src/
      islands/          # 22 page/programmatic islands + co-located tests
      components/       # Shared components: Avatar, ActivityFeed, map/, admin/
      stores/           # Preact Signals stores (mapStore, partyStore)
      data/             # Waypoints and path coordinate data
      utils/            # Map geometry, caching, color palette utilities
      types/            # TypeScript interfaces (Goal, MapViewState, etc.)
  public/               # Static assets served by Workers Assets binding
    css/                # 11 stylesheets (main, auth, calendar, drawer, friends, etc.)
    js/                 # Legacy vanilla JS + Vite-built island bundle
    img/                # Map tiles, avatars (57), goal images (~90), manifest
  migrations/           # D1 SQL migrations (129 files, 0001–0123)
  tests/                # Jest API + Playwright UI suites
    api/                # 28 Jest test files (miniflare env)
    ui/                 # 19 Playwright specs + 4 helper modules
  scripts/              # 6 Node.js asset pipeline tools
  docs/                 # Living project documentation
```

## Server — `src/`

```text
src/
  index.ts                        # Worker entry; matchRoute() router; CORS + method guards
  auth-handlers.ts                # Auth API: register, login, logout, session, preferences,
                                  #   password reset, email confirmation; validateSession(),
                                  #   validateAdminSession(); rate-limit constants
  auth-utils.ts                   # Crypto: PBKDF2 hash/verify, salt, session ID generation
  admin-handlers.ts               # Admin API: dashboard, users CRUD, goals CRUD, metrics,
                                  #   image inventory, audit log; LIKE-search escape helper
  avatar-slugs.ts                 # VALID_AVATAR_SLUGS (57 slugs), isValidAvatarSlug() guard
  email-templates.ts              # HTML + plain-text email templates (reset, confirmation)
  email-utils.ts                  # Resend API integration: sendEmail(), config constants
  fellowship-invite-handlers.ts   # Fellowship invite API: invite, list, accept, reject
  friends-handlers.ts             # Social API: friends list, pending, search, resolve code,
                                  #   request (by ID/code), accept, reject, unfriend,
                                  #   friend profile, friend positions
  goals-handlers.ts               # Goals API: handleGoalsGet, calculateTotalDistance
  map-handlers.ts                 # Map page handler: renderMapPage()
  party-handlers.ts               # Party API: create, preview, join, invite, progress,
                                  #   activity, leave, kick, settings, transfer leadership
  progress-handlers.ts            # Progress CRUD: GET/POST/PUT/DELETE
  validators.ts                   # Server-side validation (mirrors public/js/validators.js)
  renderHtml.ts                   # Bare HTML document factory (used by map page)
  renderLayout.ts                 # Shared full-page layout: head, CSS, island mount, scripts
  renderHomePage.ts               # Home redirect shell
  renderAuthPage.ts               # Login/register shell (AuthForms island)
  renderPasswordResetPage.ts      # Password reset request + set-new-password shells
  renderPartyListPage.ts          # /party shell (PartyListIsland)
  renderPartyDetailPage.ts        # /party/:id shell (PartyDetailIsland)
  renderPartyManagePage.ts        # /party/:id/manage shell (PartyManageIsland)
  renderPartyJoinPage.ts          # /party/join/:code shell (PartyJoinIsland, no main.js)
  renderFriendsPage.ts            # /friends shell (FriendsListIsland)
  renderFriendAddPage.ts          # /friends/add/:code shell (FriendAddIsland)
  renderFriendProfilePage.ts      # /friends/:id shell (FriendProfileIsland)
  renderAdminPage.ts              # /admin shell (AdminDashboardIsland)
  renderAdminGoalsPage.ts         # /admin/goals shell (AdminGoalsListIsland)
  renderAdminGoalAddPage.ts       # /admin/goals/new shell (AdminGoalAddIsland)
  renderAdminGoalEditPage.ts      # /admin/goals/:id shell (AdminGoalEditIsland)
  renderAdminUsersPage.ts         # /admin/users shell (AdminUsersListIsland)
  renderAdminMetricsPage.ts       # /admin/metrics shell (AdminMetricsIsland)
```

## Client Islands — `client/src/`

### Islands (`client/src/islands/`)

```text
MapIsland.tsx             # Full Konva.js map: tiled zoom, waypoints, paths, friend markers,
                          #   user avatar, party/personal view switching
MapWalkIsland.tsx         # Walk-logging FAB + calendar → DistanceModal flow
DrawerIsland.tsx          # Slide-out nav: session badge, pending friends/invite badges
AuthForms.tsx             # Login + registration: tab switching, password strength, URL pre-fill
DistanceModal.tsx         # Distance entry/edit modal: km/miles toggle, save/delete
GoalModal.tsx             # Goal detail + congratulations modal: image, title, description
NextGoalCard.tsx          # "Up Next" milestone card: segment progress bar
UpcomingGoalCard.tsx      # Upcoming milestone card: km-remaining, click → GoalModal
PartySelector.tsx         # Personal/party view switcher dropdown (partyStore signals)
PartyListIsland.tsx       # /party: create form, join-by-code, party list
PartyDetailIsland.tsx     # /party/:id: parallel fetch, member progress, activity feed
PartyManageIsland.tsx     # /party/:id/manage: settings, kick, transfer, regenerate invite
PartyJoinIsland.tsx       # /party/join/:code: confirm join, redirect
FriendsListIsland.tsx     # /friends: debounced search, send/accept/reject/unfriend actions
FriendAddIsland.tsx       # /friends/add: resolve code preview, confirm request
FriendProfileIsland.tsx   # /friends/:id: profile details, walking stats, friend actions
AdminDashboardIsland.tsx  # /admin: stat cards, user counts, activity overview
AdminGoalsListIsland.tsx  # /admin/goals: paginated goals table, search, sort
AdminGoalAddIsland.tsx    # /admin/goals/new: creation form, ImageBrowserModal, distance preview
AdminGoalEditIsland.tsx   # /admin/goals/:id: edit form, ImageBrowserModal, markdown preview
AdminUsersListIsland.tsx  # /admin/users: paginated user table, verify/reset/admin/delete
AdminMetricsIsland.tsx    # /admin/metrics: summary cards, leaderboard, 30-day timeline
```

Most islands have co-located `*.test.tsx` Vitest unit tests (15 of 22). Untested: AuthForms, MapIsland, MapWalkIsland, PartyDetailIsland, PartyJoinIsland, PartyListIsland, PartyManageIsland.

### Components (`client/src/components/`)

```text
ActivityFeed.tsx              # Party activity feed (used in PartyDetailIsland)
Avatar.tsx                    # Avatar <img>: resolves slug → /img/avatars/thumbs/{slug}.webp

admin/
  ImageBrowserModal.tsx       # Image browser for admin goal forms: manifest grid, onSelect

map/
  ClusterListPopup.tsx        # Desktop popup: multiple friends at same waypoint
  ClusterListSheet.tsx        # Mobile bottom-sheet equivalent
  FriendMarkers.ts            # Konva layer: avatar-image friend markers on canvas
  FriendMiniCard.tsx          # Friend info card on single marker tap
  JourneyPath.ts              # Konva polyline: walked + future path segments
  MapLegend.tsx               # Party map legend: color-coded member list
  MapWalkButton.tsx + .css    # FAB for walk-logging calendar
  MemberPaths.ts              # Konva layer: per-member colored path segments (party view)
  UserMarker.ts               # Konva marker: user avatar at current position
  WaypointMarkers.ts          # Konva layer: goal milestone circles (color by unlock)
  WaypointPopup.tsx + .css    # Desktop waypoint detail popup (position-aware)
  WaypointPopupContainer.tsx  # Bridges Konva canvas events → Preact DOM
  WaypointSheet.tsx           # Mobile bottom-sheet for waypoint details
```

### Stores (`client/src/stores/`)

```text
mapStore.ts       # Map signals: userProgress, milestones, viewState, loading/error;
                  #   computed: isLoading, hasError, unlockedMilestones
partyStore.ts     # Party signals: userParties, selectedView (localStorage-persisted),
                  #   partyProgress; computed: hasParties, isPartyView, selectedParty
```

### Data (`client/src/data/`)

```text
waypoints.ts                  # KM→(x,y) coordinate interpolation from path + goals
paths/fellowship-path.ts      # Raw coordinate array: Hobbiton → Mt Doom (10000×5455 map)
```

### Utils (`client/src/utils/`)

```text
goal-unlock-check.ts    # checkNewlyUnlockedGoals(): old vs new progress diff
map-cache.ts            # CacheStorage keys + TTL config; invalidation helpers
map-popup-utils.ts      # Popup position math: screen coords, safe zone, pan offset
map-storage.ts          # localStorage: last opened distance (miles)
map-utils.ts            # Path geometry: getUserPosition, cutoff, truncate, pathLength
party-colors.ts         # PARTY_COLORS palette, getMemberColor(), getMutedMemberColor()
```

### Types (`client/src/types/`)

```text
goal.ts     # Goal interface: id, distance, title, special, description, image_id
map.ts      # UserProgress, Milestone, MapViewState, MapLoadingState
```

## Static Assets — `public/`

```text
public/
  manifest.json       # PWA web app manifest
  sw.js               # Service worker: cache-first, build-stamped CACHE_NAME
  css/                # 11 stylesheets: main, auth, calendar, drawer, friends, goals,
                      #   map, party, profile, progress, admin + icon fonts
  js/
    main.js           # Legacy app controller: session mgmt, body.authenticated signal
    calendar.js       # Calendar domain: week/month view, date utilities
    goals.js          # Goal modal rendering
    progress.js       # Distance popup: edit/delete handlers
    profile.js        # Profile modal: avatar selection, username change
    password-reset.js # Password reset flows
    validators.js     # Client-side validation (mirrors server)
    client/
      islands.js      # Vite-built Preact island bundle (generated)
      islands.css     # Vite-built island styles (generated)
  img/
    map/tiles/        # 6-level tile pyramid (0–5) + metadata.json
    avatars/          # 57 full-size WebP + thumbs/ (64×64 WebP)
    highres/          # ~90 goal scene images (WebP)
    thumbs/           # ~90 goal scene thumbnails (WebP, -thumb suffix)
    image-manifest.json  # Generated: image_id → path mappings
```

## Migrations — `migrations/`

129 files (0001–0123, some prefixes have multiple files). Key milestones:

- `0001–0005`: Core schema (progress, goals, constraints)
- `0006–0010`: Auth tables (users, sessions, password reset tokens)
- `0011–0019`: Goal description batch updates
- `0020`: Email confirmation tokens
- `0021`: `image_id` column on goals
- `0022–0116`: Goal image assignments (~94 migrations)
- `0117–0118`: User preference columns
- `0119`: Fellowship tables (parties, party_members)
- `0120–0121`: Admin column + audit log
- `0122`: Friendships + social identity (friend_code)
- `0123`: Fellowship invites

## Tests

```text
tests/
  api/                                  # 28 Jest files (miniflare environment)
    admin-goal-create.test.ts           # Admin goal creation API
    admin-goal-edit.test.ts             # Admin goal update API
    admin-handlers.test.ts              # Admin dashboard, users, verify handlers
    admin-image-inventory.test.ts       # Image manifest / admin images
    auth-handlers.test.ts               # Full auth flow tests
    auth-utils.test.ts                  # Crypto primitives
    avatar-slugs.test.ts               # Avatar slug validation (57 slugs)
    email-templates.test.ts             # Email template generation
    email-utils.test.ts                 # Resend API wrapper (mocked)
    fellowship-invite-handlers.test.ts  # Fellowship invite CRUD
    friends-handlers.test.ts            # All friends API handlers
    goals-handlers.test.ts              # Goal fetch + distance aggregation
    index.test.ts                       # Full request routing integration
    party-handlers.test.ts              # Party create, join, progress, leave, kick
    party-management.test.ts            # Settings update + leadership transfer
    party-pages.test.ts                 # Server-rendered party HTML output
    party-progress.test.ts              # Party aggregate progress
    progress-handlers.test.ts           # Progress CRUD
    renderAdminGoalAddPage.test.ts      # Admin goal-add page HTML
    renderAdminGoalEditPage.test.ts     # Admin goal-edit page HTML
    renderAdminGoalsPage.test.ts        # Admin goals list page HTML
    renderAdminPage.test.ts             # Admin dashboard page HTML
    renderHtml.test.ts                  # HTML structure tests
    user-isolation.test.ts              # Cross-user data isolation
    validators.test.ts                  # Validation functions
    cache-version.test.js               # Service worker cache version stamp
    generate-image-manifest.test.ts     # Image manifest generation
    map-utils.test.ts                   # Map utility functions

  ui/                                   # 19 Playwright specs (chromium, 3 workers)
    admin.spec.js                       # Admin route access control
    distance-modal-shared.spec.js       # Distance modal UI flows
    email-confirmation.spec.js          # Email confirmation flow
    fellowship-comprehensive.spec.js    # Multi-user party flows (two-browser)
    fellowship-functional.spec.js       # Single-user party page UI
    goals.spec.js                       # Goal milestone modals
    map-avatar-marker.spec.js           # Avatar marker rendering on map
    map-canvas.spec.js                  # Map tile loading + Konva stage
    map-popup.spec.js                   # Waypoint detail popup
    map-shell.spec.js                   # Map page auth, drawer, keyboard
    map-walk-logging.spec.js            # FAB → calendar → distance entry
    navigation.spec.js                  # Navigation and responsiveness
    password-reset.spec.js              # Password reset flows
    preference-toggle.spec.js           # Goal visibility preference toggle
    profile.spec.js                     # Profile modal flows
    progress.spec.js                    # Progress CRUD UI
    story-1-7-modal-improvements.spec.js # Modal UX improvements
    system.spec.js                      # System/network health checks
    user-isolation.spec.js              # Cross-user isolation E2E
    helpers/
      common.js                         # Fixtures, BASE_URL, deterministic wait signals
      cleanup.js                        # Test data cleanup via API
      test-auth.js                      # Login helpers
      mock-auth.ts                      # TEST_MOCK_TOKEN bypass
```

## Scripts — `scripts/`

```text
generate-image-manifest.js    # Scans highres + thumbs → image-manifest.json
optimize-images.js            # sharp: raw goal images → WebP highres + thumbnails
optimize-avatars.js           # sharp: ComfyUI PNGs → {slug}.webp + 64×64 thumbs
tile-map-image.js             # Generates 6-level tile pyramid from source map
convert-map-images.js         # One-time raw map → WebP conversion
test-ui-all-browsers.js       # Sequential per-browser Playwright runner
```

## Entry Points and Integration Paths

- Worker entry: `src/index.ts`
- Island hydration entry: `client/src/index.tsx`
- Main journey render: `src/renderHtml.ts` → legacy JS + programmatic islands
- Map render: `src/map-handlers.ts` → `MapIsland`
- Fellowship pages: `src/renderParty*Page.ts` → party islands
- Friends pages: `src/renderFriend*Page.ts` → friend islands
- Admin pages: `src/renderAdmin*Page.ts` → admin islands

Integration boundaries:

- SSR provides mount points (`data-island` attributes) and script/style includes.
- Legacy JS and islands interoperate via bridge globals (`window.preact`, `window.preactIslands`, `window.partyStore`).
- D1 is the central persistence layer for all features.
- Deterministic hydration signals: `body.authenticated` (main.js), `[data-hydrated="true"]` (islands entry).
