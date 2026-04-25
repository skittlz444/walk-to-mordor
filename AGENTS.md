# Walk to Mordor — Agent Context

This file is injected by OpenClaw into every agent session (full and sub-agent `promptMode: minimal`). It provides the essential project rules and pointer map so any agent can orient quickly.

## Project

Walk to Mordor is a **Cloudflare Workers** web app for tracking walking distance against Middle-earth milestones.

- **Repo**: https://github.com/skittlz444/walk-to-mordor
- **Docs**: `docs/` (see `docs/index.md` for the full listing)

## Stack

| Layer | Technology |
|---|---|
| Runtime | Cloudflare Workers (single monolith) |
| Database | D1 SQLite (`DB` binding) — source of truth |
| Frontend | SSR shells + Preact islands (`client/src/`) + legacy vanilla JS (`public/js/`) |
| Map | Konva.js via `react-konva` |
| Email | Resend API |
| Testing | Jest (backend), Vitest (client), Playwright (E2E) |
| Deployment | Wrangler (`wrangler.json`) |

## Critical Rules

### Code
- **TypeScript strict mode** everywhere. No `any`. Define interfaces for all D1 results.
- **Islands Rule**: New interactive features → `client/src/` (Preact islands). Do **not** rewrite working legacy `public/js/` without explicit permission.
- **File manipulation**: Use IDE tools (`create_file`, `edit_file`). Never use terminal commands for file writes.

### Architecture
- Single Worker entry: `src/index.ts`. Route → handler mappings in `docs/architecture.md`.
- All DB access via `DbClient` wrapper: `db.read` for SELECT, `db.write` for INSERT/UPDATE/DELETE.
- Static assets served from `public/` via `ASSETS` binding — no R2 for goal images.
- `renderLayout.ts` controls CSS inclusion; extra stylesheets must be explicitly listed per page.

### Testing
- **Playwright**: `npm run test:ui -- --run` (avoid interactive prompts).
- **Coverage**: Maintain >90% for new code.
- **Visual**: Use Snapshots for Konva/Canvas.
- Pre-configure state via API calls (e.g. `PUT /api/user/preferences`) — do **not** use `page.route()` session interception.

### Documentation
- Docs live in `docs/`. Keep files < 500 lines; split by domain if larger.
- Update docs immediately after code changes that affect rules or conventions.
- For documentation guidelines, see `docs/AGENTS.md`.

## Key File Map

| Domain | Location |
|---|---|
| Worker entry & router | `src/index.ts` |
| Auth & session | `src/auth-handlers.ts` |
| Progress & goals | `src/progress-handlers.ts`, `src/goals-handlers.ts` |
| Fellowship | `src/party-handlers.ts`, `src/fellowship-invite-handlers.ts` |
| Friends | `src/friends-handlers.ts` |
| Admin | `src/admin-handlers.ts` |
| Island hydration entry | `client/src/index.tsx` |
| Map island | `client/src/components/map/` |
| Preact Signals stores | `client/src/stores/` |
| Legacy JS controller | `public/js/main.js` |
| D1 migrations | `migrations/` (0001–0129) |
| E2E tests | `tests/ui/` |
| Backend tests | `tests/api/` |

## OpenClaw Injection Conditions

This file (`AGENTS.md`) is injected under "Project Context" in the following conditions:

| `promptMode` | Files injected |
|---|---|
| `full` (main session) | All bootstrap files: `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md` (new workspaces), `MEMORY.md` (when present) |
| `minimal` (sub-agents) | `AGENTS.md` + `TOOLS.md` only |
| `none` | Base identity line only — no bootstrap files |

**Gates that can suppress injection:**
- `agents.defaults.skipBootstrap: true` in OpenClaw config — skips all bootstrap file injection.
- `agents.defaults.bootstrapMaxChars` — truncates individual bootstrap files at this character limit.
- `agents.defaults.bootstrapTotalMaxChars` — truncates the combined bootstrap payload at this total limit.
- File absence — if `AGENTS.md` does not exist at the workspace root (or the configured `agents.defaults.workspace` path), it is silently omitted.

**This repository** has no `openclaw.json` / `openclaw.json5` config, so all defaults apply. `AGENTS.md` (this file) is at the workspace root and will be injected on every turn for full sessions and all sub-agent (`promptMode: minimal`) sessions.
