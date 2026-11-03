# Proposal

## Why

The navigation drawer renders inside `<header>`, and `header` is a stacking context (`position: relative; z-index: 2`). Every page overlay that lives inside `<main>` and sets a z-index above 2 therefore paints on top of the open drawer and its backdrop. On the map page in party view this is visible as the party distance legend (`z-index: 12`) floating over the drawer, and the same defect lets the map calendar sheet (`z-index: 200`) cover it. The drawer is meant to be the topmost navigation surface on any page, so this is a real layering bug rather than a cosmetic coincidence.

## What Changes

- Raise the header's stacking layer while the drawer is open (`body.drawer-open`), so the drawer and its backdrop paint above page content overlays and below app-level modals. This applies to every page, not only the map.
- Document the resulting layer order in `drawer.css` so future overlays do not silently land above the navigation drawer again.
- Add a Playwright regression test that opens the drawer over the map page and asserts the drawer wins the hit test over a page overlay at the same point.
- No markup, component, or JavaScript changes. The drawer stays inside `<header>`; only its stacking context changes while open.

## Capabilities

### New Capabilities

- `navigation-drawer`: the stacking contract for the global navigation drawer, its backdrop, and the surfaces it must sit above and below.

### Modified Capabilities

None. No existing capability describes drawer layering.

## Impact

- CSS: `public/css/drawer.css` gains a drawer-open stacking rule and a documented layer scale. No stylesheet reordering.
- Tests: one Playwright regression in `tests/ui/map-shell.spec.js` (or a sibling spec) using the existing authenticated test helper; no new dependency or fixture.
- Unchanged: `DrawerIsland` markup, focus management, `inert` handling, the `body.drawer-open` class contract, and all app-level modals (z-index 1000+) keep their current relative order above the drawer.
- Rollback: deleting the new CSS rule restores the previous layering; there is no persisted state.
