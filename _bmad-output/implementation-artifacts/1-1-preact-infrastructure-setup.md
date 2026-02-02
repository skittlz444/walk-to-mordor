# Story 1.1: Preact Infrastructure Setup

Status: ✅ completed
Issue: #155
Completed: 2026-01-17

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Developer**,
I want **to set up the foundational Preact build infrastructure in `client/src/`**,
so that **we can build modern, interactive UI components (like the Map) using an "Islands Architecture" approach.**

## Acceptance Criteria

- [x] **Directory Structure**: Create `client/` structure: `client/src/`, `client/src/components/`, `client/src/islands/`, `client/src/utils/`, `client/src/stores/`.
- [x] **Build Configuration**: Configure **Vite** (recommended per Architecture) or esbuild for Preact compilation.
    - [x] Must alias `react` → `preact/compat` and `react-dom` → `preact/compat` (Required for future Konva usage).
    - [x] Build output must target `public/js/client/` (or similar asset path served by Worker).
- [x] **TypeScript**: Configure `client/tsconfig.json` (explicitly separate from root) to support JSX/TSX.
- [x] **Scripts**: Add npm scripts to root `package.json`:
    - [x] `npm run build:client`
    - [x] `npm run dev:client` (watch mode)
- [x] **Proof of Concept**: Created a sample "HelloWorld" Preact island component (now removed - served its purpose).
    - [x] Created `client/src/islands/HelloWorld.tsx` (removed after proof-of-concept validation).
    - [x] **Must demonstrate Signal usage** (e.g., a simple counter or toggle) to verify state management setup.
    - [x] Mount it to a `<div id="preact-root">` in a test HTML page or existing page (temporary).
- [x] **Documentation**: Document the island mounting pattern in a new `docs/frontend-guide.md` linked from architecture.
- [x] **Verification**: Verify the built JS file loads correctly in the browser and renders interaction.

## Tasks / Subtasks

- [ ] **Initialize Client Project**
  - [ ] Create `client/` folder structure.
  - [ ] Add devDependencies to root `package.json` for `preact`, `vite`, etc. (Monorepo-lite style preferred for simplicity, or separate if needed).
- [ ] **Install Dependencies**
  - [ ] Runtime: `npm install preact @preact/signals`
  - [ ] Dev: `npm install -D vite @preact/preset-vite typescript @types/node`
- [ ] **Configure Vite**
  - [ ] Create `client/vite.config.ts`.
  - [ ] Configure `build.outDir` to `../public/js/client`.
  - [ ] Set `emptyOutDir: true`.
  - [ ] Configure generic `react` aliases to `preact/compat`.
- [ ] **Configure TypeScript**
  - [ ] Create `client/tsconfig.json`.
  - [ ] Ensure `jsx: "react-jsx"` and `jsxImportSource: "preact"`.
- [ ] **Create Hydration Logic**
  - [ ] Create `client/src/index.tsx` to handle looking for island roots (e.g., `data-island="Name"`) and mounting components.
- [ ] **Create Example Island** (Note: HelloWorld proof-of-concept has been removed)
  - [ ] Create production islands like `client/src/islands/GoalModal.tsx`.
  - [ ] Implement using `@preact/signals` (e.g. `useSignal` for local state).
  - [ ] Add integration with actual application features.
- [ ] **Update Documentation**
  - [ ] Create `docs/frontend-guide.md` with instructions on how to create and mount a new Preact component.

## Dev Notes

### Architecture Alignment
- **Islands Architecture**: We are NOT building a SPA. We are building "islands" of interactivity that live within the server-rendered HTML. The Worker renders HTML, Preact hydrates specific `div`s.
- **Preact + Signals**: Use Signals for state management from Day 1.
- **Konva Prep**: The alias configuration is critical now so we don't have to refactor when we add Map (Epic 2).

### File Structure
As defined in `docs/architecture.md`:
```
client/                     # Frontend Source (Preact)
├── src/
│   ├── components/
│   ├── islands/            # Entry points for specific page widgets
│   ├── stores/             # Global State (Signals)
│   ├── utils/
│   ├── index.tsx           # Main hydration script
│   └── vite-env.d.ts
├── tsconfig.json
└── vite.config.ts          # Build config
```

### Build Integration
- The Cloudflare Worker serves static assets from `public/`.
- The Vite build must dump the compiled JS/CSS into `public/js/client/`.
- During dev, we might need a way to run `wrangler dev` AND `vite build --watch` in parallel.
    - Recommend `concurrently` or `npm-run-all` in `package.json` for a `dev:all` script.

## References

- [Architecture: Frontend Framework Evolution](docs/architecture.md#adr-001-frontend-framework-evolution)
- [Architecture: Project Structure](docs/architecture.md#complete-project-directory-structure)
- [Legacy Content]: `public/js/` contains existing vanilla JS. DO NOT DELETE or overwrite existing legacy files.

## Dev Agent Record

### Agent Model Used
Claude 3.7 Sonnet (2026-01-17)

### Completion Notes List
- [x] Confirmed strict mode TypeScript with `client/tsconfig.json`
- [x] Validated `preact/compat` alias works in `client/vite.config.ts`
- [x] Checked that `public/` assets are correctly served by Worker after build
- [x] Successfully built client bundle to `public/js/client/islands.js` (23KB)
- [x] Created and tested HelloWorld island with Signal-based counter and toggle (removed after validation)
- [x] Verified island hydration in browser with interactive testing
- [x] Created comprehensive `docs/frontend-guide.md` with examples and best practices
- [x] Added Playwright UI tests for island hydration and interactivity
- [x] Linked frontend guide from `docs/architecture.md`

### File List
- `package.json` (Root updates - added preact dependencies and build scripts)
- `package-lock.json` (Dependency lock file)
- `client/vite.config.ts` (Vite build config with react aliases)
- `client/tsconfig.json` (TypeScript config for client)
- `client/src/vite-env.d.ts` (Vite environment types)
- `client/src/index.tsx` (Island hydration entry point)
- `client/src/islands/HelloWorld.tsx` (Proof-of-concept island with Signals - removed)
- `docs/frontend-guide.md` (Comprehensive developer documentation)
- `docs/architecture.md` (Updated with link to frontend guide)
- `public/islands-test.html` (Test page for island verification - removed)
- `public/js/client/islands.js` (Built bundle)
- `tests/ui/islands.spec.js` (Playwright tests for islands)
