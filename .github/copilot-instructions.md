# Development Guidelines & Project Context

## Infrastructure & Architecture
The underlying infrastructure for this project is built on Cloudflare Workers, utilizing Wrangler for deployment and management.
- **Runtime**: Cloudflare Workers (Single Worker Monolith).
- **Database**: D1 (SQLite) - The source of truth.
- **Frontend Strategy**: "Islands Architecture".
  - **Legacy**: Vanilla JS in `public/js/`.
  - **New Components**: Preact in `client/src/` (e.g., Maps, new UI).
  - **State**: Preact Signals for new client logic.
- **Map**: Konva.js / react-konva for interactive maps.
- **Assets**: Served via Assets Binding.

## Coding Standards
- **TypeScript**: Strict mode is enforced. No `any`. Define interfaces for all D1 results.
- **File Manipulation**: Prioritize `create_file`, `edit_file` and `replace_string_in_file`. **NEVER** use `run_in_terminal` for file manipulation.
- **Islands Rule**: Do not rewrite working legacy Vanilla JS without explicit permission. New features go to `client/`.

## Testing
Always ensure that your code changes are covered by appropriate tests.
- **Playwright**: Use `npm run test:ui`. Use `--run` flag to avoid interactive prompts.
- **Coverage**: Maintain >90% coverage for new code.
- **Visual Testing**: Use Snapshots for Konva/Canvas elements.
- **Docs**: Update `docs/`, `TESTING.md` when patterns change.

## Documentation
- Location: `docs/`.
- Size: Keep files < 500 lines. Break them up if larger.
- Update immediately after code changes.

## Tools & MCP Servers
You have access to:
- **GitHub MCP**: PRs and CI.
- **Cloudflare Documentation MCP**: APIs and services.
- **Playwright MCP**: Browser testing.
- **Context7 MCP**: SDK/Library up-to-date info.
