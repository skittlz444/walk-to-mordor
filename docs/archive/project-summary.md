---
name: project-summary
description: Product scope, runtime overview, and high-level project layout.
---

# Project Summary: Walk to Mordor

*Last updated: 2026-03-17*

## Product Scope

Walk to Mordor is a Cloudflare Workers web app for tracking walking distance against Middle-earth milestones.

Current feature domains:
- Account management (register, login, email confirmation, password reset)
- Personal progress (daily logging, calendar history, milestone unlocking)
- Interactive map (`/map` with friend markers and hover mini-cards)
- Fellowship system (parties, invites, messaging, unified activity feed)
- Friends (search, requests, profiles, blocking)
- Avatar system (40+ selectable avatars with slug validation)

## Runtime and Delivery Model

- Runtime: single Worker monolith (`src/index.ts`) with server-rendered HTML responses.
- Database: Cloudflare D1 SQLite (`DB` binding).
- Static assets: Workers Assets binding from `public/` (`ASSETS` binding).
- Frontend strategy: legacy vanilla modules in `public/js/` plus Preact islands in `client/src/`.
- Rendering approach: SSR shell + island hydration + vanilla orchestration.

## Key Constraints

- Legacy `/wtm` route aliases are deprecated — do not reintroduce.
- Legacy vanilla JS in `public/js/` must not be rewritten without explicit permission.
- Static assets live in `public/img` — no R2 integration at this time.
- Routes, directories, and test commands are discoverable from source — see `src/index.ts`, `package.json`.
