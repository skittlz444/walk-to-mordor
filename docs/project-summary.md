# Project Summary: Walk to Mordor

**Walk to Mordor** is a web application that tracks walking progress towards the goal of walking from Bag End to Mordor, inspired by *The Lord of the Rings*.

## Overview
The application allows users to:
- Authenticate (Register, Login, Email Confirmation, Password Reset).
- Log daily walking distances.
- Visualize progress on a calendar.
- Unlock milestones (Goals) based on total distance travelled, with narrative descriptions and imagery.
- Compute cumulative distance relative to the Middle-earth journey.

## Project Structure
The project is a **Monolith** built on **Cloudflare Workers**.

- **Backend**: Cloudflare Workers (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: Server-Side Rendered (SSR) HTML + Vanilla JavaScript + Preact Islands
- **Email**: Resend API for transactional emails (confirmation, password reset)
- **Infrastructure**: Managed via `wrangler`

## Key Directories
- `src/`: Backend logic, Workers entry point, API handlers, email utilities, and HTML rendering templates.
- `client/`: Preact islands source (TSX components, Vite build pipeline).
- `public/`: Static assets served directly (images, compiled JS/CSS).
- `migrations/`: SQL migration files for the D1 database.
- `scripts/`: Utility scripts (image optimization).
- `docs/`: Project documentation.

## Technology Stack
- **Platform**: Cloudflare Workers
- **Language**: TypeScript
- **Database**: D1 (SQLite)
- **Frontend**: HTML5, CSS3, Vanilla JS (ES Modules), Preact (Islands Architecture)
- **Build**: Vite (client), Wrangler (backend)
- **Testing**: Jest (backend), Vitest (client), Playwright (E2E)
