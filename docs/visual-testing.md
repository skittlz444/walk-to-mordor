# Visual Testing Guide

This document describes how the Playwright visual regression tests work for the Walk to Mordor map and how to maintain the snapshot baselines.

## Overview

Visual regression tests capture screenshots of key UI states and compare them against committed baseline images. Any unintentional pixel-level change causes the test to fail, alerting developers to investigate.

The tests live in `tests/ui/map-visual.spec.js` with baseline snapshots stored in `tests/ui/map-visual.spec.js-snapshots/`.

## Test Coverage

| Test | Snapshot File | Description |
|------|--------------|-------------|
| Default State | `map-default-zoom.png` | Map at initial zoom (~1.7×) with 100 km progress |
| Zoomed Out | `map-zoomed-out.png` | Map at 0.5× scale |
| Zoomed In | `map-zoomed-in.png` | Map at 2× scale |
| Path 100 km | `map-path-100km.png` | Journey path with 100 km walked |
| Path 500 km | `map-path-500km.png` | Journey path with 500 km walked |
| Waypoints Zoomed Out | `map-waypoints-zoomed-out.png` | Major-only waypoints at 0.5× |
| Waypoints Zoomed In | `map-waypoints-zoomed-in.png` | All-tier waypoints at 2× |
| Calendar Modal | `map-with-calendar-modal.png` | Map with calendar sheet open |
| Modal Dismissed | `map-modal-dismissed.png` | Map after calendar sheet closed |
| Mobile | `map-mobile-default.png` | Pixel 5 viewport (393×851) |

In addition to the snapshot tests, there are three assertion-only tests:

- **Pan position consistency** – verifies the initial stage position and scale are finite and reproducible.
- **Waypoints visible at default zoom** – asserts marker count > 0.
- **Unlocked vs locked markers** – asserts both interactive and non-interactive markers exist.

## Deterministic Baselines

Every test seeds the same environment to ensure reproducibility:

| Seed | Value |
|------|-------|
| Desktop viewport | 1280 × 720 (Chromium default) |
| Mobile viewport | 393 × 851 (Pixel 5) |
| Tile metadata | Stub: 1024 × 512, two zoom levels |
| Tile images | 10 × 10 solid-colour PNG |
| `/api/total-distance` | `{ totalDistance: 100 }` (km) or `{ totalDistance: 500 }` |
| `/api/goals` | 11 mock goals from 0–700 km |
| `mapLastOpenedDistanceMiles` | Cleared from localStorage |
| Konva animations | Stopped before every screenshot |

### Why stub tiles?

Real map tiles load asynchronously over the network and may arrive in different orders between runs, making the canvas non-deterministic. Intercepting tile requests with an instant, identical stub image removes that source of flakiness. The tests still exercise the full Konva rendering pipeline, path drawing, waypoint markers, and UI overlays — only the background imagery is simplified.

## Running the Tests

### Run all visual tests (Chromium)

```bash
npm run test:ui -- --grep "Map Visual" --project chromium
```

### Run a single test

```bash
npm run test:ui -- --grep "map renders at default zoom" --project chromium
```

### Run in headed mode (to watch)

```bash
npm run test:ui:headed -- --grep "Map Visual" --project chromium
```

## Updating Baselines

When you intentionally change the map UI (colours, layout, markers, controls, etc.) the snapshot tests will fail. After reviewing the diff images:

1. **Inspect the failures** — look at `test-results/` for `*-actual.png`, `*-expected.png`, and `*-diff.png` files.

2. **Update baselines** if the changes are intentional:

   ```bash
   npm run test:ui -- --update-snapshots --grep "Map Visual" --project chromium
   ```

3. **Commit the updated snapshots** with a clear message:

   ```bash
   git add tests/ui/map-visual.spec.js-snapshots/
   git commit -m "chore: update map visual snapshots after <reason>"
   ```

> **Tip:** Always mention the canonical viewport, mock progress seed, and map asset in the commit message so reviewers can reproduce the baselines.

## Debugging Snapshot Failures

### View the diff images

After a failure, Playwright writes three images into `test-results/<test-name>/`:

| File | Purpose |
|------|---------|
| `*-expected.png` | The committed baseline |
| `*-actual.png` | What the test captured |
| `*-diff.png` | Highlighted pixel differences |

### Use the HTML report

```bash
npm run test:ui:report
```

Opens an interactive report where you can click on failed tests and compare the screenshots.

### Use Playwright traces

Tests that fail on CI capture traces automatically (configured as `trace: 'on-first-retry'`):

```bash
npx playwright show-trace test-results/<test-folder>/trace.zip
```

## CI Integration

The visual tests run as part of the existing `pr-tests.yml` workflow. They are **automatically skipped** on all Playwright projects except the Desktop `chromium` project. Firefox, Mobile Chrome, and Mobile Firefox projects see the tests as "skipped" — not failed — so CI stays green.

The baseline snapshots are committed to the repository so CI compares against them directly.

### Snapshot file naming

Playwright appends the project name and platform to snapshot filenames: `<name>-chromium-linux.png`. The CI environment (Ubuntu + Chromium) matches the naming convention. If you generate baselines on macOS, the suffix will differ (`chromium-darwin.png`) and CI will not find a match. **Always generate baselines in a Linux environment** (or in CI itself) to avoid mismatches.

## Cross-Browser Notes

- **Primary**: Desktop `chromium` project. All baselines target this project. The tests skip automatically on all other projects.
- **Mobile Chrome**: The mobile viewport is tested within the spec by setting `page.setViewportSize()` explicitly in the Chromium project. It does not run under the separate "Mobile Chrome" Playwright project (to avoid needing duplicate baselines).
- **Firefox**: Not included for visual snapshots due to minor canvas anti-aliasing differences. Functional map tests (`map-canvas.spec.js`, `map-shell.spec.js`) cover Firefox.

## Architecture

```
tests/ui/
├── map-visual.spec.js              # Visual regression test file
├── map-visual.spec.js-snapshots/   # Baseline PNG images (committed)
│   ├── map-default-zoom-chromium-linux.png
│   ├── map-zoomed-out-chromium-linux.png
│   ├── ...
├── helpers/
│   └── common.js                   # Shared test fixtures and helpers
```

### Key helpers in `map-visual.spec.js`

| Helper | Purpose |
|--------|---------|
| `setupMapTestState(page, opts)` | Intercept tile + API routes with deterministic data |
| `waitForCanvasReady(page)` | Wait for Konva canvas to have non-zero dimensions |
| `waitForMapLoaded(page)` | Wait for loading overlay to disappear |
| `waitForPathRendered(page)` | Wait for path layer to contain Line shapes |
| `waitForWaypointsRendered(page)` | Wait for marker layer to be populated |
| `setMapZoom(page, scale)` | Programmatically set Konva stage scale |
| `stopAllAnimations(page)` | Stop Konva animations for stable screenshots |
| `countVisibleWaypoints(page)` | Count child shapes on the waypoint marker layer |

### Snapshot comparison options

```javascript
{
  maxDiffPixels: 500,   // Allow up to 500 pixels difference
  threshold: 0.3,       // 30% per-pixel colour tolerance
  timeout: 15000,       // 15 s for stability checks
  animations: 'disabled' // CSS animations paused by Playwright
}
```

These values accommodate minor anti-aliasing differences across headless Chromium versions while still catching meaningful regressions.
