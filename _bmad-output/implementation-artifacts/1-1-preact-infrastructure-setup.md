# Story 1.1: Preact Infrastructure Setup

Status: ready-for-dev
Issue: #155

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Developer**,
I want **to set up the foundational Preact build infrastructure in `client/src/`**,
so that **we can build modern, interactive UI components (like the Map) using an "Islands Architecture" approach.**

## Acceptance Criteria

- [ ] **Directory Structure**: Create `client/` structure: `client/src/`, `client/src/components/`, `client/src/islands/`, `client/src/utils/`, `client/src/stores/`.
- [ ] **Build Configuration**: Configure **Vite** (recommended per Architecture) or esbuild for Preact compilation.
    - [ ] Must alias `react` → `preact/compat` and `react-dom` → `preact/compat` (Required for future Konva usage).
    - [ ] Build output must target `public/js/client/` (or similar asset path served by Worker).
- [ ] **TypeScript**: Configure `client/tsconfig.json` (explicitly separate from root) to support JSX/TSX.
- [ ] **Scripts**: Add npm scripts to root `package.json`:
    - [ ] `npm run build:client`
    - [ ] `npm run dev:client` (watch mode)
- [ ] **Proof of Concept**: Create a sample "HelloWorld" Preact island component.
    - [ ] Create `client/src/islands/HelloWorld.tsx`.
    - [ ] **Must demonstrate Signal usage** (e.g., a simple counter or toggle) to verify state management setup.
    - [ ] Mount it to a `<div id="preact-root">` in a test HTML page or existing page (temporary).
- [ ] **Documentation**: Document the island mounting pattern in a new `docs/frontend-guide.md` linked from architecture.
- [ ] **Verification**: Verify the built JS file loads correctly in the browser and renders interaction.

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
- [ ] **Create Hello World Island**
  - [ ] `client/src/islands/HelloWorld.tsx`.
  - [ ] Implement using `@preact/signals` (e.g. `useSignal` for local state).
  - [ ] Add a test route or modify `index.html` locally to test it.
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
Gemini 3 Pro (Preview)

### Completion Notes List
- [ ] Confirmed strict mode TypeScript.
- [ ] Validated `preact/compat` alias works.
- [ ] Checked that `public/` assets are correctly served by Worker after build.

### File List
- `package.json` (Root updates)
- `client/vite.config.ts`
- `client/tsconfig.json`
- `client/src/index.tsx`
- `client/src/islands/HelloWorld.tsx`
- `docs/frontend-guide.md`
