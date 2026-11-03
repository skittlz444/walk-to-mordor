# Tasks

## 1. Legacy calendar week convention

- [x] 1.1 In `public/js/calendar.js`, add a shared `WEEKDAY_LABELS` constant reading `Mon … Sun` plus `getWeekStart(date)` and `getMonthGridStart(date)` helpers using the Monday-based index `(getDay() + 6) % 7`. Route `renderWeekView` and `renderSheetWeekView` through them. Verify on the dev server that the journey week view and the map calendar sheet both show Mon→Sun headers, start on Monday, and place today under its weekday.
- [x] 1.2 Update `renderMonthView` and `renderSheetMonthView` to start their grids from `getMonthGridStart` and use `WEEKDAY_LABELS`. Verify in both month views that a month beginning on Sunday (e.g. March 2026) shows six previous-month cells before the 1st, that every date sits under its own weekday, and that neighbouring-month cells keep the `other-month` de-emphasis.
- [x] 1.3 Extend `tests/ui/navigation.spec.js` with assertions that the week view and month view headers read `Mon` through `Sun`, and that the first week-view cell is the Monday of the displayed week. Verify with `npm run test:ui -- tests/ui/navigation.spec.js`.
- [x] 1.4 Extend `tests/ui/map-walk-logging.spec.js` with the same Monday-first assertions for the map calendar sheet's week and month views. Verify with `npm run test:ui -- tests/ui/map-walk-logging.spec.js -g "Monday-first"`.

## 2. Stats heatmap week convention

- [x] 2.1 In `client/src/components/HeatmapCalendar.tsx`, change `DAY_LABELS` to `Mon … Sun` and compute the grid's column index as `(getUTCDay() + 6) % 7` for both leading padding and row grouping, keeping latest-week-first ordering. Verify manually on the Stats → Heatmap tab that rows read Monday→Sunday and a known logged date sits under its weekday header.
- [x] 2.2 Extend `client/src/components/__tests__/HeatmapCalendar.test.tsx` to assert the header order, that a given `data-date` cell's column matches its weekday, and that a non-Monday `startDate` pads the correct number of empty leading cells in the earliest row. Verify with `npm run test:client`.

## 3. Integration validation

- [x] 3.1 Run `npm run test:client`, `npm run test:ui -- tests/ui/navigation.spec.js`, and `npx eslint public/js/calendar.js client/src/components/HeatmapCalendar.tsx tests/ui/navigation.spec.js`; confirm all pass.
- [x] 3.2 Run `npm run build` and confirm `public/js/client/islands.js` regenerates and the service-worker cache version updates; then verify in a browser with a hard reload that journey week view, map calendar sheet (week and month), and stats heatmap all agree on Monday-first ordering.
- [x] 3.3 Run `openspec validate monday-first-week-calendar --strict` and confirm the change passes validation.

## Workflow follow-up

- Archive the change after review requirements are satisfied and verify the archived specs.
