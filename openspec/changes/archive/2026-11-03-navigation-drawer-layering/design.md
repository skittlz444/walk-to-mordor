# Design

## Context

See `proposal.md` for motivation. The relevant current state:

- `header` is a stacking context: `position: relative; z-index: 2` (`public/css/main.css:96`). `DrawerIsland` mounts inside it (`src/renderLayout.ts:93`), so the drawer, backdrop, and attribution dialog are all clamped to the header's layer.
- Page overlays live in `<main>` and set their own z-index values that exceed 2: map loading overlay 10 (`public/css/map.css:61`), party legend 12 (`public/css/main.css:554`), map social/party panels 15 (`public/css/main.css:340`), friend mini-card 20 (`public/css/main.css:476`), waypoint popup 30 (`client/src/components/map/WaypointPopup.css:8`), journey calendar container 100 (`public/css/calendar.css:261`), calendar modal and map calendar sheet 200 (`public/css/calendar.css:355`, `:420`).
- Drawer layers inside the header context: backdrop 20 (`public/css/drawer.css:12`), drawer 25 (`:26`), attribution overlay 30 (`:137`).
- App-level dialogs sit at 1000 (`public/css/party.css:663`, `public/css/profile.css:226`, `public/css/palantir.css:57`, `public/css/admin.css:1146`), the PWA banner at 9999 (`public/css/main.css:624`), and the progress modal at 11000 (`public/css/progress.css:14`).

Because a child cannot paint above its ancestor stacking context, the open drawer renders beneath every page overlay with z-index ≥ 3. The report shows the party legend over the drawer; the same defect covers the map calendar sheet.

Reproduced with the real stylesheets in headless Chromium at 375×700 by computing `document.elementFromPoint` at the legend/drawer overlap:

| State | Point over party legend + drawer | Point over map calendar sheet + drawer |
|---|---|---|
| Current | `.map-legend` | calendar sheet content |
| Drawer portaled to `<body>` (values unchanged) | `.side-drawer` | calendar sheet content (z 200 still wins) |
| Drawer portaled + drawer layer raised to 900 | `.side-drawer` | `.side-drawer` |
| `body.drawer-open header { z-index: 900 }`, no DOM change | `.side-drawer` | `.side-drawer` |

## Goals / Non-Goals

**Goals**

- The open drawer and its backdrop always paint above page content and page-level overlays on every page.
- No change to drawer markup, state, focus handling, or the `body.drawer-open` contract.
- Keep the existing, intentional hierarchy: app-level dialogs and banners stay above navigation.

**Non-Goals**

- Redesigning the drawer, its width, animation, or accessibility behavior.
- Re-tiering existing page overlays or introducing a design-token/z-index system across the app.
- Changing any API, database, or server-rendered markup.

## Decisions

### D1: Raise the header's stacking context only while the drawer is open

Add to `public/css/drawer.css`:

```css
/* The drawer mounts inside <header>, which is a stacking context at z-index 2
   (main.css). Raise that context while open so page overlays cannot paint over
   the drawer. Keep below app-level modals (1000). */
body.drawer-open header {
  z-index: 900;
}
```

Rationale: one rule fixes every page overlay below 900 without touching component code; the header is already the drawer's ancestor, so this makes the existing hierarchy explicit instead of relying on a low value that loses to ordinary page widgets. It is scoped to the open state, so closed-drawer layering is untouched.

**Alternatives considered**

1. **Portal the drawer to `<body>`** (e.g. `createPortal` from `preact/compat`). Portaling escapes the header context but does not by itself fix the ordering: with the current 20/25 values the 200-level calendar sheet still painted above the drawer in the reproduction. It would require also raising the drawer values, plus a `preact/compat` import and test updates — more surface for the same outcome.
2. **Raise `header` permanently (not scoped to `body.drawer-open`)**. Simpler rule, but it changes page layering while the drawer is closed; for example the map calendar modal (200) would then render beneath the header title and menu button.
3. **Lower each page overlay below 3** (map legend, social panels, friend card, waypoint popup, calendar sheet, and future ones). Whack-a-mole across pages, and it breaks the deliberate "above map controls" ordering those overlays rely on.
4. **Move the drawer mount out of `<header>`.** The trigger button needs the header's absolute positioning; moving the island changes trigger placement on every page.

### D2: Document the layer scale in the same file

Record the resulting order next to the rule so future overlays land deliberately:

- page content and page overlays: 1–200
- navigation drawer/backdrop: 900 (inside the raised header context)
- app-level modals: 1000
- PWA install banner: 9999
- progress modal: 11000

`900` is chosen because the highest existing page overlay is 200 and the lowest app-level dialog is 1000; it leaves headroom on both sides.

### D3: Regression test at the paint-order level

Add a Playwright test that opens the map party view, opens the navigation drawer, and asserts `document.elementFromPoint` at a point covered by the party legend resolves to the drawer/backdrop rather than the legend. Probe using the legend's measured bounding box instead of hard-coded coordinates, and take the point from the legend's left edge so it works on both desktop and narrow viewports. Add the map calendar sheet as a second probe in the same test, since it is an easy deterministic page overlay and covers the generic case.

The test creates its fellowship through the API (the pattern already used in `tests/ui/fellowship-comprehensive.spec.js`), runs under its per-test auth token, and relies on the suite's existing isolation/reseed convention. Party rows are not explicitly deleted: `cleanupAllTestData` only removes calendar-progress rows and there is no party delete endpoint.

## Risks / Trade-offs

- **A future page overlay above 900 reintroduces the bug** → the layer scale comment plus the regression test make the ceiling explicit; new overlays should stay at or below 200 unless they are app-level dialogs.
- **The rule depends on the drawer remaining inside `<header>`** → the comment names that dependency. If the drawer is ever portaled or the header restructured, the test still validates observable behavior and will flag the stale rule.
- **Raising the header could lift the title/menu button above page content while open** → harmless: the backdrop (z 20) is inside the same raised context, so the backdrop still dims the header content and intercepts clicks. The regression test probes a page overlay point, not header content.
- **Hit-test flakiness from hydration timing** → wait for `body.drawer-open` and for the legend element before measuring, matching the existing map tests' wait strategy.

## Migration Plan

Single CSS rule plus a test. Deploy with the normal client build (`npm run build:client`); no data changes and no cache-key concerns beyond the existing stylesheet cache behavior. Rollback is deleting the rule.

## Open Questions

None.
