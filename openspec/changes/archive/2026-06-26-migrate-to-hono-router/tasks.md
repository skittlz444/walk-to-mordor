## 1. Setup

- [x] 1.1 Install Hono: `npm install hono`.
- [x] 1.2 Import Hono in `src/index.ts`: `import { Hono } from 'hono'` and `import { createMiddleware } from 'hono/factory'`.

## 2. Core Hono App Infrastructure

- [x] 2.1 Create the Hono app instance and DbClient injection middleware: `c.set('db', createDbClient(c.env.DB))`.
- [x] 2.2 Create the auth middleware (`validateSession` adapter) that sets `c.get('userId')` on success or returns 401.
- [x] 2.3 Create the admin middleware (`validateAdminSession` adapter) that sets `c.get('userId')` and `c.get('adminUserId')` on success or returns 403.
- [x] 2.4 Create route groups with auth middleware: public routes registered directly on app, authenticated routes behind `app.use('/api/*', authMiddleware)`, admin routes behind `app.use('/api/admin/*', adminMiddleware)`. (Note: Sub-apps were not used due to Hono 405 detection limitations with sub-app routing; routes are registered directly on the main app with middleware groups instead.)

## 3. SSR Page Routes

- [x] 3.1 Register all SSR page routes using `c.html()`: `/login`, `/password-reset`, `/reset-password`, `/map`, `/`, `/journey`, `/profile`, `/friends`, `/friends/:id`, `/friends/add/:friendCode`, `/stats`, `/party`, `/party/join/:inviteCode`, `/party/:id`, `/party/:id/manage`.
- [x] 3.2 Register all admin SSR page routes: `/admin`, `/admin/goals`, `/admin/goals/new`, `/admin/goals/:id`, `/admin/storylines`, `/admin/users`, `/admin/metrics`.

## 4. Public API Routes

- [x] 4.1 Register public auth routes: `POST /api/register`, `POST /api/login`, `POST /api/logout`, `GET /api/session`, `POST /api/password-reset-request`, `POST /api/password-reset`, `GET /api/auth/confirm-email`, `POST /api/auth/resend-confirmation`, `GET /api/push/vapid-key`.
- [ ] 4.2 Register public event routes: `GET /api/events`, `GET /api/events/:id`, `GET /api/events/:id/community-progress`. (Skipped: event handlers do not exist yet.)

## 5. Authenticated API Routes

- [x] 5.1 Register profile routes: `PUT /api/profile`, `PUT /api/user/preferences`, `PUT /api/user/storyline`.
- [x] 5.2 Register avatar and storyline routes: `GET /api/avatars`, `GET /api/storylines`.
- [x] 5.3 Register progress routes: `POST /api/calendar-progress`, `PUT /api/calendar-progress`, `DELETE /api/calendar-progress`, `GET /api/calendar-progress`.
- [x] 5.4 Register goals and stats routes: `GET /api/goals`, `GET /api/stats/weekly`, `GET /api/stats/heatmap`, `GET /api/stats/wrapped`, `GET /api/total-distance`.
- [ ] 5.5 Register achievements route: `GET /api/achievements`. (Skipped: achievements handler does not exist yet.)
- [x] 5.6 Register push routes: `POST /api/push/subscribe`, `DELETE /api/push/subscribe`, `GET /api/push/status`, `PUT /api/push/settings`.
- [ ] 5.7 Register event routes: `POST /api/events/daily-roll`, `POST /api/events/daily-roll/accept`, `POST /api/events/daily-roll/decline`, `GET /api/events/mine`, `POST /api/events/:id/join`. (Skipped: event handlers do not exist yet.)
- [x] 5.8 Register party routes: `POST /api/party`, `GET /api/user/parties`, `GET /api/user/parties/positions`, `GET /api/user/fellowship-invites`, `POST /api/user/fellowship-invites/:inviteId/accept`, `POST /api/user/fellowship-invites/:inviteId/reject`.
- [x] 5.9 Register party parameterized routes: `GET|POST /api/party/join/:inviteCode`, `POST /api/party/:id/invite`, `POST /api/party/:id/invite-friend`, `GET /api/party/:id/progress`, `GET /api/party/:id/activity`, `POST /api/party/:id/messages`, `POST /api/party/:id/leave`, `POST /api/party/:id/kick/:userId`, `PUT /api/party/:id/settings`, `PUT /api/party/:id/storyline`, `POST /api/party/:id/transfer-leadership`.
- [x] 5.10 Register friend routes: `GET /api/friends`, `GET /api/friends/pending`, `GET /api/friends/search`, `POST /api/friends/request`, `POST /api/friends/request/code`, `GET /api/friends/positions`, `GET /api/friends/resolve/:friendCode`, `GET /api/friends/:userId/profile`, `POST /api/friends/:friendshipId/accept`, `POST /api/friends/:friendshipId/reject`, `DELETE /api/friends/:friendshipId`.

## 6. Admin API Routes

- [x] 6.1 Register admin dashboard and user routes: `GET /api/admin/dashboard`, `GET /api/admin/users`, `PUT /api/admin/users/:id/verify`, `PUT /api/admin/users/:id/reset`, `PUT /api/admin/users/:id/admin`, `DELETE /api/admin/users/:id`.
- [x] 6.2 Register admin metrics routes: `GET /api/admin/metrics`, `GET /api/admin/metrics/leaderboard`, `GET /api/admin/metrics/timeline`.
- [x] 6.3 Register admin goals routes: `GET|POST /api/admin/goals`, `GET|PUT /api/admin/goals/:id`, `GET /api/admin/images`.
- [x] 6.4 Register admin storylines routes: `GET|POST /api/admin/storylines`, `GET|PUT /api/admin/storylines/:id`, `PUT /api/admin/storylines/:id/goals`.
- [ ] 6.5 Register admin encounter routes: (Skipped: encounter handlers do not exist yet.)
- [ ] 6.6 Register admin campaign routes: (Skipped: campaign handlers do not exist yet.)
- [ ] 6.7 Register admin field guide routes: (Skipped: field guide handlers do not exist yet.)

## 7. Cleanup

- [x] 7.1 Remove the `matchRoute()` function and the `getAllowedMethods()` function from `src/index.ts`.
- [x] 7.2 Remove the monolithic if/else chain from the fetch handler.
- [x] 7.3 Remove the shared `body` variable and `safeJsonParse` call from the top of fetch — body parsing is now per-route via `c.req.json()`.

## 8. Fetch Handler Integration

- [x] 8.1 Rewrite the `fetch` handler to: serve static assets first (unchanged), then delegate to `app.fetch(request, env, ctx)`.
- [x] 8.2 Verify the `scheduled()` handler is unchanged.

## 9. Testing

- [x] 9.1 Update Jest tests that mock `fetch` to use Hono's `app.request()` test utility for route dispatch tests.
- [x] 9.2 Run `npm test` and fix any regressions — focus on route dispatch, auth guard behavior, and parameterized path extraction.
- [x] 9.3 Run `npm run check` and resolve TypeScript issues with Hono types and context variables.
- [ ] 9.4 Run `npm run dev` and manually test key endpoints (login, session validation, calendar progress, goals, admin dashboard) to verify behavior parity.
- [ ] 9.5 Update `docs/architecture.md` with the new Hono-based routing architecture, middleware pattern, and route registration conventions.
