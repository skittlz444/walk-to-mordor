# Story 1.4: Intermediary Goals System (Issue #140)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **Administrator**,
I want **to insert new narrative milestones between existing goals using strict distance sorting**,
so that **I can improve the narrative pacing and density of the journey without complex ordering logic**.

## Acceptance Criteria

1.  **Schema Update**: The `goals` table must have an `image_id` column (TEXT) to explicitly link images, decoupling them from the auto-increment `id`.
2.  **Migration**: A migration script adds `image_id` and populates it with the existing `id` (as text) for all current rows (preserving legacy image links).
3.  **Missing Images**: The new system must handle `NULL` values for `image_id` (for new goals without art), preventing 404 requests in the UI.
4.  **Intermediary Goals**: Analyze existing goals to identify any distance gaps greater than 70km (~43 miles). Insert new intermediary goals (with `image_id` as NULL) to ensure no gap exceeds this threshold. If fewer than 5 goals are needed to meet this requirement, that is acceptable.
5.  **Sorting Logic**: The application (backend and frontend) must strictly sort goals by `distance ASC`. No `sort_order` column is needed.
6.  **Code Updates**:
    - `src/goals-handlers.ts`: Return `image_id` in the API response.
    - `public/js/goals.js`: Use `goal.image_id` to construct image URLs (`/img/highres/${image_id}.jpg`). If `image_id` is null, do not render the image container.

## Tasks / Subtasks

- [ ] **Database Schema Update**
  - [ ] Create migration `0020_add_image_id_to_goals.sql`.
  - [ ] Add `image_id` column (TEXT).
  - [ ] Update existing rows: `UPDATE goals SET image_id = CAST(id AS TEXT)`.
  - [ ] Verify `image_id` is populated.
- [ ] **Content Injection**
  - [ ] Create migration `0021_add_intermediary_goals.sql`.
  - [ ] Identify and insert intermediary goals to close all >70km gaps.
  - [ ] Ensure they have `NULL` for `image_id`.
  - [ ] Ensure they have `NULL` for `special` unless impactful.
- [ ] **Backend Updates**
  - [ ] Update `src/goals-handlers.ts` to select `image_id`.
  - [ ] Ensure `ORDER BY distance ASC` is the default sorting.
- [ ] **Frontend Updates**
  - [ ] Update `public/js/goals.js` `showGoalModal`.
  - [ ] Change logic to check `if (goal.image_id)`.
  - [ ] Update string template to use `${goal.image_id}` instead of `${goal.id}`.
- [ ] **Verification**
  - [ ] Verify existing goals still show images.
  - [ ] Verify new intermediary goals appear in the list in correct distance order.
  - [ ] Verify new goals do NOT show broken image icons (should show no image).

## Dev Notes

### Architecture & Schema
- **Database**: D1 (SQLite).
- **Column**: `image_id` (TEXT).
- **Sorting**: STRICTLY `distance ASC`. New goals inserted at e.g. 23 miles will naturally fall between 15 and 32 miles.
- **Handling Nulls**: The frontend must be robust. `goal.image_id` being null must result in a text-only modal header (or generic placeholder if design requires, but AC says "no image container").

### Intermediary Goal Candidates (Miles)
1. **Woody End** (~23 miles): Between Stock Road (15) and Black Rider (32).
2. **The High Hay** (~80 miles): Between Crickhollow (73) and Old Forest (87).
3. **Fog on the Downs** (~106 miles): Between Bombadil (98) and Wights (115).
4. **The East Road** (~125 miles): Between Wights (115) and Bree (135).
5. **Emyn Muil Foothills** (~1167 miles): Between Camp (1155) and Lowlands (1180).

### Testing Standards
- **Manual Verification**: Add a goal locally, log distance to unlock it, verify modal.
- **Unit Tests**: Update API tests to expect `image_id` field.

## Dev Agent Record

### Agent Model Used
Gemini 3 Pro (Preview)

### Completion Notes List
- [ ] Switched strategy from `sort_order` to `distance` sorting.
- [ ] Added `image_id` requirement for explicit asset management.
- [ ] Identified 5 specific intermediary goals to fill gaps.

### File List
- `migrations/0020_add_image_id_to_goals.sql` (New)
- `migrations/0021_add_intermediary_goals.sql` (New)
- `src/goals-handlers.ts`
- `public/js/goals.js`

