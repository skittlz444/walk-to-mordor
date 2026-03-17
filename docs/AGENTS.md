# Documentation Guidelines for AI Agents

This `docs/` folder is written **for AI agents** as the primary audience. Every document should help an agent produce correct, idiomatic code on the first attempt — not serve as a human reference manual.

## Core Principles

1. **Don't document what the code already says.** Agents can read and search source files. Focus on *why* decisions were made, *where* to look (broadly), and *what rules to follow* — not line-by-line descriptions of how things work.
2. **Keep it short.** Each doc must be **< 500 lines**, ideally **< 300 lines**. If a doc grows past the limit, first ask: can the agent discover this by searching the code? If yes, delete the section and add a one-line pointer instead. If no, split the doc by domain.
3. **Rules over descriptions.** Prefer imperative statements ("Always validate X", "Never use Y") over narrative prose. Bullet lists and tables beat paragraphs.
4. **Encode decisions, not discoveries.** Document architectural choices, constraints, and trade-offs that an agent can't infer from a code scan — e.g. "We use static assets in `public/img` instead of R2 for goal images" or "Legacy vanilla JS in `public/js/` must not be rewritten without explicit permission."
5. **Point, don't duplicate.** Reference file paths and directories so agents know where to look; don't copy source code into docs. Example: "Friends API → `src/friends-handlers.ts`" is better than reproducing the handler logic.
6. **Stay current or delete.** Stale docs are worse than no docs — they cause hallucinated patterns. Archive anything outdated into `docs/archive/`.

## What to Include in a Doc

| Include | Avoid |
|---|---|
| Canonical rules and constraints | Restating type signatures or function bodies |
| Architectural decisions and rationale | Step-by-step code walkthroughs |
| Feature domain → file/directory map | Exhaustive file-by-file inventories |
| Schema invariants and migration conventions | Full SQL DDL dumps (agents can read migrations) |
| Testing patterns and required coverage | Listing every test file |
| Error handling conventions | Cataloguing every error code |
| Cross-cutting concerns (auth model, SSR flow) | Obvious framework boilerplate |

## How to Structure a Doc

Every doc should start with YAML front matter so agents can identify and filter documents without reading the full body:

```yaml
---
name: architecture
description: Production architecture, request flow, and deployment model for the CF Worker monolith.
---
```

- `name` — short identifier (typically the filename without extension).
- `description` — one-sentence summary of what the doc covers and when an agent should read it.

After the front matter:

```
# Title (matches filename minus extension)

## Section (rule-focused)
- Bullet: imperative rule or constraint
- Bullet: where to look (`path/to/dir/`)
- Bullet: decision rationale (brief)

## Section 2
...
```

- **No preamble.** The front matter `description` replaces any "This document describes…" filler.
- **Use headers for scanability.** Agents parse markdown structure; flat walls of text are harder to extract from.
- **Tables for mappings.** Feature→file, endpoint→handler, config→purpose — tables are compact and scannable.
- **Code fences only for examples.** Short snippets showing the *right* pattern, not full implementations.

## Doc Index

See [index.md](index.md) for the full listing. Key groupings:

- **Architecture & structure**: `architecture.md`
- **Data & API contracts**: `data-models.md`, `api-reference.md`
- **Frontend patterns**: `frontend-guide.md`, `design-guide.md`
- **Operations**: `asset-workflow.md`, `email.md`

## Maintenance Rules

- Update docs **immediately** after code changes that affect rules, architecture, or conventions.
- Run the BMAD document-project workflow for broad rescans; make targeted edits for small changes.
- When a doc exceeds 500 lines, first ask: can the agent discover this by searching the code? If yes, replace the section with a one-line pointer. If no, split the doc by domain.
- When a doc becomes obsolete, move it to `docs/archive/` and remove it from `index.md`.
