# Tasks

## 1. Client Event

- [ ] 1.1 In `public/js/progress.js`, dispatch a `wtm:walk-saved` `CustomEvent` on `document` with `{ action, date, distance }` after a successful create and update, and after a successful delete. Dispatch only when the response is `ok`; do not dispatch for rejected writes. Keep the existing UI updates and callbacks unchanged. Verify by loading the map and journey pages and logging a walk with the browser console open.

## 2. Queue Merge

- [ ] 2.1 In `client/src/stores/badgeAwardModalStore.ts`, add `mergePendingAwards(awards)` that appends only awards whose `instance_id` is not already queued and leaves the current index untouched. Add refresh coordination state so a second request runs at most once while one is in flight, and so a save during a check sets a single queued re-run. Verify with new Vitest cases.

## 3. Modal Refresh

- [ ] 3.1 In `client/src/islands/BadgeAwardModal.tsx`, share the pending fetch between hydration and the `wtm:walk-saved` listener; on save, merge, skip `delete`, and open through the existing `openWhenNoModalIsOpen` deferral when the modal is not already visible. Treat failed responses as silent and never surface the acknowledge error banner. Verify with new Vitest cases for open-without-queue, append, duplicate suppression, delete, failure, and coalescing.

## 4. Tests

- [ ] 4.1 Extend `client/src/islands/BadgeAwardModal.test.tsx` to cover the save-triggered checks listed in the spec delta. Run `npx vitest run --root client src/islands/BadgeAwardModal.test.tsx` and record the result.
- [ ] 4.2 Add a Playwright case to `tests/ui/map-walk-logging.spec.js` (or a new spec) that logs a walk from the map and asserts the award modal opens without a page reload. Run it against an isolated `wrangler dev` and record the result.

## 5. Validation

- [ ] 5.1 Run `openspec validate badge-award-on-walk-save --strict` and resolve any spec-format errors.
- [ ] 5.2 Run the existing achievement/badge client tests plus the new specs, and record the counts. Confirm no change to award rules, endpoints, migrations, or dismiss semantics.
- [ ] 5.3 Run `lean-review` and `test-hygiene` in diff mode and resolve must/should findings.

## Workflow follow-up

- Archive the change after the reviewed implementation and Playwright verification land.
