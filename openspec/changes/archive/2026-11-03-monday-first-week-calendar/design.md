# Design

## Context

See `proposal.md` - Why. Two independent implementations draw calendar weeks today:

- `public/js/calendar.js` (legacy vanilla module, loaded on the journey page) renders four grids: `renderWeekView` and `renderMonthView` for the page, and `renderSheetWeekView` and `renderSheetMonthView` for the map page bottom sheet. Each of the four repeats its own `['Sun', …]` label array and its own Sunday-based date arithmetic.
- `client/src/components/HeatmapCalendar.tsx` (Preact island) builds rows with `dayOfWeek = getUTCDay()` and pads the first row from Sunday, with `DAY_LABELS` matching that order.

Both grids are order-agnostic at the CSS layer (`grid-template-columns: repeat(7, 1fr)` in `public/css/calendar.css` and `public/css/palantir.css`), so only JavaScript ordering and date math change. The legacy module's DOM contract (`.calendar-cell`, `data-date`, `data-timestamp`, `.day-header`) is used by its own click handlers and by Playwright helpers, so it must be preserved. Weekday labels are fixed English abbreviations today; there is no locale layer to update. Achievement logic in `src/achievement-awards.ts` already computes Monday–Sunday weeks, so the backend convention is the target state.

## Goals / Non-Goals

**Goals:**

- One Monday-first week convention across every weekday display: journey week view, journey month view, map calendar sheet (both views), and stats heatmap.
- A single source of truth for weekday labels and week-start math in the legacy calendar module, replacing four duplicated copies.
- Keep the existing DOM structure, class names, and data attributes so click handlers, e2e selectors, and styling behave unchanged.
- Make the label order and the date placement provably consistent through tests.

**Non-Goals:**

- No change to week-view or month-view titles (still the month/year of the displayed week's Monday or of the month itself). Showing a full date range such as `29 Sep – 5 Oct` is out of scope.
- No user-selectable week-start preference; Monday-first is fixed for all users.
- No locale/i18n work and no change to label casing or styling.
- No change to heatmap layout (latest week still on top, columns still days) and no change to streak calculations.
- No API, D1, or achievement-rule changes.

## Decisions

### 1. Use a Monday-based day index derived from the existing getter

Both modules keep their current date basis and convert the weekday index to Monday-first:

- Legacy calendar (local calendar dates): `(date.getDay() + 6) % 7`
- Heatmap (UTC date strings): `(date.getUTCDay() + 6) % 7`

The formula returns `0` for Monday through `6` for Sunday and is used both to find the week's Monday and to place a date in its column. Alternative considered: subtracting `day === 0 ? 6 : day - 1` - equivalent but more branches, and it diverges more from the heatmap implementation. Keeping each module on its existing local/UTC basis avoids an off-by-one at day boundaries; mixing bases would be the main correctness risk here.

### 2. Consolidate labels and anchors inside the legacy module

Add one `WEEKDAY_LABELS` constant and two small helpers near the top of `public/js/calendar.js`: one returning the Monday of a date's week, one returning the Monday on or before a month's first day. Both helpers are pure and reused by all four render paths. The module stays a global script in its existing style and its `window.calendarModule` export surface is unchanged; no new file, build step, or framework is introduced. Alternative considered: leave the four copies and edit each - rejected because the duplication is what makes a future week-start change error-prone, and the diff is smaller with helpers.

### 3. Month grids keep their full-week loops

The month grid still starts from a computed leading date and emits whole weeks of seven cells, breaking once the grid passes the last day of the month. Only the leading-date calculation changes: from "the Sunday on or before the 1st" to "the Monday on or before the 1st". This means a month beginning on Sunday now gets six leading cells from the previous month rather than none. The existing per-row termination conditions remain valid because they assume seven-cell rows, not a particular weekday.

### 4. Heatmap padding and grouping use the same Monday index

`buildGrid` computes the Monday-based index for the first displayed day, emits that many empty padding cells, then groups cells into seven-column rows. Because padding count equals the first day's column index, a row always reads Monday→Sunday, and the final partial week is padded at the end as it is today. `weeks.reverse()` is untouched, so the newest week remains the top row. Alternative considered: build Sunday-first rows and rotate each row afterwards - more code and easier to misalign the month labels, which are derived by scanning each row's first real cell.

### 5. Keep rendered labels fixed in English

`Mon` … `Sun` are written literally, matching the existing UI's fixed English abbreviations and the badge copy ("Monday through Sunday"). Introducing `Intl.DateTimeFormat` for two-letter labels would change casing and punctuation per environment and is not needed for this change.

## Risks / Trade-offs

- **Labels and date math drift apart** → Both come from the shared helpers in the legacy module and the single index formula in the heatmap; tests assert that a known date lands in the column matching its weekday, not just that the labels changed.
- **Off-by-one at UTC/local boundaries in the heatmap** → The heatmap keeps `getUTCDay()` because its dates are UTC date strings; the journey calendar keeps local `getDay()` because its dates are local. The design explicitly avoids converting between the two bases.
- **A first partial heatmap row is padded incorrectly** → Cover with a fixture whose earliest date is mid-week and assert the leading empty-cell count equals the Monday-based index (e.g. a Wednesday start yields two empty cells before it).
- **Previously shown neighbouring-month dates change** (month starting on Sunday now shows six prior-month dates) → Intended visual consequence; `other-month` styling already de-emphasizes them, and a scenario covers it.
- **Week-view title shifts on month-boundary weeks** (the title now uses the Monday's month) → Accepted; title logic is intentionally unchanged. The existing Playwright navigation test exercises month view titles, which are unaffected.
- **Stale legacy JS or island bundle in browsers** → `public/js/calendar.js` is served through the service worker's stale-while-revalidate cache; the normal `npm run build` bumps the cache version, and local verification needs `npm run build:sw` or a hard reload. Rollout needs no flag.
