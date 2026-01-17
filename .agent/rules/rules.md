# Project Context & Development Rules

- **Repository**: https://github.com/skittlz444/walk-to-mordor

## Technology Stack
- **Runtime**: Cloudflare Workers (Single Worker Monolith)
- **Database**: D1 (SQLite)
- **Frontend**: Preact (Islands Architecture), Vanilla JS (Legacy)
- **Map**: Konva.js / react-konva
- **Testing**: Playwright (`npm run test:ui`), Jest
- **Deployment**: Wrangler

## Critical Implementation Rules

### 1. Infrastructure & Architecture
- **Monolith**: API and Site deployed to single Worker.
- **Assets**: Served via Assets Binding.
- **State**: D1 is truth. Signals for client reactive state.

### 2. Coding Standards
- **TypeScript**: Strict mode. No `any`.
- **Preact Islands**: New components in `client/src/`. Legacy in `public/js/`.
- **Konva**: Use `react-konva` components.
- **File Manipulation**: Use IDE tools (create_file, etc.), NOT terminal commands.

### 3. Testing Guidelines
- **Playwright**: Use `npm run test:ui`. Avoid interactive prompts.
- **Coverage**: Maintain >90% coverage for new code.
- **Visual**: Use Snapshots for Canvas/Map.

### 4. Documentation
- Location: `docs/`.
- Size: <500 lines per file.
- Update docs immediately after code changes.

### 5. AI Agent Tools
- Use available MCP servers (GitHub, Cloudflare, Playwright).
- Validate assumptions against codebase, not just outdated docs.
- **Subagents**: For goal updates, perform tasks directly in main agent; avoid browser subagent if possible.
