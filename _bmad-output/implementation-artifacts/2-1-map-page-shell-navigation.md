# Story 2.1: Map Page Shell & Navigation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Walker**,
I want **to navigate between the Dashboard, Map, and my Profile using a side menu**,
so that **I can easily switch contexts without cluttering the main view**.

## Acceptance Criteria

1.  **Route & Page**:
    *   GET `/map` renders a new HTML page shell.
    *   Page title is "Walk to Mordor - Middle Earth" (or similar).
2.  **Navigation (Side Drawer)**:
    *   **Header Icon**: The existing "Profile" icon in the header is REPLACED by a "Hamburger" menu icon (`fa-bars`).
    *   **Side Drawer**: Clicking the hamburger icon slides out (or opens) a navigation side panel/drawer.
    *   **Drawer Items**:
        1.  **Journey**: Links to the dashboard (`/`).
        2.  **Map**: Links to the map page (`/map`).
        3.  **Profile**: Opens the existing Profile Popup (`showProfileModal()`).
    *   **Behavior**:
        *   Drawer overlays content or pushes it.
        *   Drawer can be closed via an "X" button or clicking outside (backdrop).
        *   Clicking "Profile" in the drawer opens the modal and closes the drawer.
3.  **Container**:
    *   Page contains a full-viewport (or appropriately sized) container div: `<div data-island="MapIsland"></div>`.
    *   CSS ensures the container fills the available space (minus header).
4.  **Island Loading**:
    *   Page loads the `islands.js` bundle.
    *   A simple `MapIsland` component renders "Loading Middle-earth..." (placeholder) inside the container.
5.  **Responsive**:
    *   Layout works on mobile (320px) and desktop.
    *   No horizontal scrollbars on the page shell itself.
6.  **Auth Protection**:
    *   `/map` is a protected route. Unauthenticated requests redirect to the login page (or render the auth wall) using the same session check logic already used for `/`.
    *   An authenticated user hitting `/map` never sees a flash of unauthorized content before the shell loads.

## Tasks / Subtasks

- [ ] **1. Install Dependencies**
    - [ ] `npm install konva react-konva use-image` (Root package.json)
    - [ ] Verify `client/vite.config.ts` has aliases for `react` -> `preact/compat`.
- [ ] **2. Backend: Route and Handler**
    - [ ] Create `src/map-handlers.ts`: Logic to render the map HTML.
        - [ ] Should check session/auth (protected route).
        - [ ] Render template with `renderHtml` or specialized map template.
    - [ ] Register `/map` route in `src/router.ts`.
- [ ] **3. Frontend: Navigation & Drawer**
    - [ ] **Modify Header**: In `src/renderHtml.ts`, replace the `.profile-icon` button with a `.menu-icon` button (using `fa-bars` or similar).
    - [ ] **Add Drawer HTML**: Add the HTML structure for the `side-drawer` (hidden by default) in `src/renderHtml.ts`.
    - [ ] **Add Drawer CSS**: Create `public/css/drawer.css` (or add to `main.css`) for the styling (slide-in animation, backdrop, item styling).
    - [ ] **Add Drawer JS**: Add simple vanilla JS logic (inline or in `public/js/drawer.js`) to toggle the drawer open/close.
        - [ ] Handle "Profile" click -> `showProfileModal()` + close drawer.
- [ ] **4. Frontend: Create Island**
    - [ ] Create `client/src/islands/MapIsland.tsx`.
        - [ ] Simple component: `return <div className="map-container">Map Coming Soon</div>`.
    - [ ] Register in `client/src/index.tsx` (export `MapIsland` in `allIslands` or `autoHydratedIslands`).
- [ ] **5. Testing**
    - [ ] Create `tests/ui/map-shell.spec.js`:
        - [ ] Visit `/map`.
        - [ ] Verify "Hamburger" icon exists.
        - [ ] Click Hamburger -> Verify Drawer opens.
        - [ ] Verify Drawer links ("Journey", "Map", "Profile").
        - [ ] Click "Journey" -> Verify URL is `/`.
        - [ ] Click "Map" -> Verify URL is `/map`.
        - [ ] Click "Profile" -> Verify Profile Modal opens.
        - [ ] Hit `/map` without a session cookie and assert the user is redirected to the auth experience (status + URL check).

## Dev Notes

### Architecture Compliance
-   **Islands Pattern**: Use `data-island="MapIsland"` in the HTML output. The standard hydration script (`islands.js`) will pick this up.
-   **Preact**: The `MapIsland` is a Preact component.
-   **Routing**: Handled by Cloudflare Worker (`router.ts`), NOT client-side routing.
-   **CSS**:
    -   Can use `public/css/map.css` (linked in head) OR component-scoped styles.
    -   Recommended: Create `public/css/map.css` for the map-page specific layout (full screen container).

### Source Tree Hints
-   **Router**: `src/router.ts`
-   **Header/Layout**: Likely in `src/renderHtml.ts` or a `src/renderLayout.ts`. Check `renderHtml.ts` first.
-   **Frontend Entry**: `client/src/index.tsx`.

### Dependencies
-   **Konva**: Even though this story is just the shell, install `konva` now to ensure the build environment is ready for Story 2.2.
-   **Types**: Might need `@types/react-konva` (or it might be included). Check if errors occur.

## Dev Agent Record

### Agent Model Used
{{agent_model_name_version}}

### File List
-   package.json
-   src/map-handlers.ts (new)
-   src/router.ts
-   src/renderHtml.ts (or component that renders header)
-   client/src/islands/MapIsland.tsx (new)
-   client/src/index.tsx
-   tests/ui/map-shell.spec.js (new)
-   public/css/map.css (new, optional but recommended)
