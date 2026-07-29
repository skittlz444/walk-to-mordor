## Context

Walk to Mordor currently stores only a single authored description on each goal and renders it through the existing goal surfaces. The relevant implementation already spans several layers: goal data comes from storyline-aware goal queries in the Worker, the admin goal edit experience is a Preact island with Markdown preview, the journey goals list still uses legacy `public/js/goals.js`, and `GoalModal` is a shared Preact surface used for personal, map, and fellowship milestone views.

This change is cross-cutting because it adds a new data model, expands goal API shapes, introduces admin CRUD, adds new display states to both legacy and island-based goal surfaces, and needs best-effort discovery analytics without making content reads or modal opens slower. The user has also clarified that content is not independently locked: if a goal is visible in a given context, its content is visible in that same context, and if a locked goal has content the UI should tease that fact instead of hiding it.

## Goals / Non-Goals

**Goals:**
- Add authored rich content attached directly to goals with ordering, content type, Markdown body, and optional attribution.
- Reuse the exact same unlock semantics as existing goal viewing in both personal and fellowship contexts.
- Extend goal surfaces so goals with extra content advertise that fact, including blurred teaser placeholders for locked goals.
- Add goal-content management to the existing admin goal editing flow instead of inventing a separate admin area.
- Render unlocked content in `GoalModal` with distinct story, poetry, and appendix treatments.
- Record lightweight discovery analytics without blocking user-facing reads or interactions.

**Non-Goals:**
- Introduce a separate content publishing workflow, moderation queue, or review system.
- Create a standalone lore page outside goal-attached discovery.
- Add strict Markdown authoring constraints beyond safe HTML sanitization.
- Add automated lore or copyright validation.
- Rewrite the legacy goals list into a fully new island architecture as part of this change.

## Decisions

### 1. Use a dedicated `goal_content` table plus a lightweight discovery-event table

The change will add a `goal_content` table keyed to `goals.id` with `type`, `title`, `body`, `author_attribution`, and `sort_order`, plus timestamps. Ordering and uniqueness will be enforced by `UNIQUE(goal_id, sort_order)` because content is displayed as one ordered sequence per goal regardless of type.

Validation limits will be intentionally simple:
- `title`: max 120 characters
- `author_attribution`: max 255 characters
- `body`: max 20,000 characters for all content types
- `sort_order`: integer from 0 to 999

The body limit is shared across story, poetry, and appendix entries rather than type-specific because the user explicitly prefers giving content authors room to use the longer limit when needed.

For lightweight discovery metrics, the change will add a second append-only table such as `content_discovery_events` with columns for `id`, `user_id` nullable, `party_id` nullable, `goal_id`, `content_id` nullable, `event_type`, `context_type`, and `created_at`.

Alternatives considered:
- Reusing `goals.description` for all content types was rejected because it cannot model multiple ordered entries per goal.
- `UNIQUE(goal_id, type, sort_order)` was rejected because it allows order collisions between types while the UI renders a single ordered stream.
- Type-specific body caps were rejected because they create needless editorial constraints without a clear UX benefit.

### 2. Use current app naming and goal-scoped routes

The API and admin surfaces will use current app names consistently:
- Admin: `/api/admin/goals/:goalId/content`
- Public: `/api/goals/:goalId/content`

This aligns with the existing route vocabulary and avoids mixing `milestone` and `goal` terminology inside the same change.

Alternatives considered:
- Using `milestones` in routes was rejected because the codebase, admin pages, and existing APIs are already goal-centric.

### 3. Reuse existing goal unlock semantics exactly, including fellowship context

There will be no separate content locking mechanism. The Worker will reuse the same unlock logic already implied by goal viewing in the relevant context:
- Personal reads use the active user's storyline-aware displayed distance against the storyline goal distance for the requested goal.
- Fellowship reads use the same fellowship progress context that currently allows a party milestone to be viewed.

To preserve this behavior without inventing a parallel endpoint family, the public content route will support an optional `partyId` query parameter. Without `partyId`, the route evaluates personal progress. With `partyId`, it evaluates fellowship progress for that requesting user and party.

Alternatives considered:
- Using canonical `goals.distance` was rejected because goals are already storyline-aware through `storyline_goals`.
- A separate fellowship content endpoint was rejected because the behavior is the same and only the unlock context changes.

### 4. Expose `has_content` on goal responses and derive teaser UI client-side

`GET /api/goals` will add `has_content: boolean` for any goal that has one or more `goal_content` rows, regardless of whether the goal is currently unlocked. This is intentional: the product wants upcoming goals to hint that additional content exists.

The client will derive teaser behavior from two facts it already has or can infer:
- `has_content`
- whether the goal is locked in the current context

Locked goals with `has_content = true` will show a blurred or obscured teaser placeholder wherever extra goal content is surfaced, rather than the real content.

Alternatives considered:
- Hiding content existence for locked goals was rejected because it conflicts with the desired incentive mechanic.
- Returning a more complex content preview payload in `/api/goals` was rejected to keep the list API lightweight and SWR-friendly.

### 5. Extend existing goal surfaces instead of creating parallel UI

Admin authoring will be added to `AdminGoalEditIsland`, reusing its existing Markdown preview pattern with `marked` and `DOMPurify`.

Public presentation will extend `GoalModal` for unlocked content, while goal list and card surfaces will only show teaser state and a lightweight indicator of additional content. Because the journey goal list is still hybrid, the implementation must touch both:
- legacy `public/js/goals.js`
- Preact `NextGoalCard` and `UpcomingGoalCard`

This avoids a broad rewrite while still giving new content a first-class UI path.

Alternatives considered:
- Building a dedicated admin content page was rejected because goal content is edited in the context of a single goal.
- Rewriting the legacy goals list was rejected as too large for the scope of this change.

### 6. Use permissive Markdown rendering with sanitization

Goal content bodies will render through the existing client-side stack of `marked` followed by `DOMPurify`. The goal is editorial flexibility rather than a tightly restricted Markdown dialect, but rendered HTML will still be sanitized before insertion into the DOM.

Alternatives considered:
- Plain-text-only content was rejected because authored lore benefits from headings, emphasis, lists, and block quotes.
- Unsanitized Markdown HTML was rejected because admin-authored content is still user-entered content from the browser's point of view.

### 7. Define appendix truncation by stripped-text word count

Appendix entries will default to collapsed when the rendered content exceeds 500 words, measured using plain text derived from the Markdown body after stripping markup. Stories and poetry will not use this truncation rule.

Alternatives considered:
- Counting raw Markdown characters was rejected because markup noise distorts what the user actually reads.
- Server-side truncation was rejected because the user explicitly wants client-side expand/collapse behavior.

### 8. Record discovery analytics as best-effort background writes

Content discovery events should never block content reads, modal rendering, or goal list loads. The design therefore assumes a best-effort logging path using `ctx.waitUntil(...)` from the Worker request lifecycle, with failures swallowed after logging.

That implies a small Worker plumbing change: the `fetch` handler in `src/index.ts` will need to accept `ctx: ExecutionContext` so relevant routes can schedule analytics writes after the response is created.

Alternatives considered:
- Synchronous analytics writes were rejected because they would add latency and create new failure modes on read-only user actions.
- Fully client-only analytics with no persistence was rejected because the success metric needs durable aggregated events.

## Risks / Trade-offs

- [Hybrid UI duplication] → The teaser state must be implemented in both legacy goal rendering and Preact goal cards. Mitigation: keep the API contract minimal (`has_content`) and share styling tokens and naming.
- [Unlock-context ambiguity] → Personal and fellowship views can unlock the same goal through different distance contexts. Mitigation: make the public content read endpoint explicitly context-aware via optional `partyId`.
- [Background analytics may drop events] → Best-effort writes can be lost if the Worker is interrupted. Mitigation: accept eventual undercounting as preferable to slowing user interactions.
- [Permissive Markdown can produce inconsistent author output] → Flexible content may vary visually more than goal descriptions do today. Mitigation: sanitize HTML and constrain presentation through content-type-specific container styles.
- [Expanded `/api/goals` shape is SWR-cached] → Clients may briefly hold stale `has_content` booleans after admin edits. Mitigation: keep cache-version and stale-while-revalidate behavior as-is; correctness self-heals on background refresh.

## Migration Plan

1. Add an additive migration for `goal_content` and an additive migration for `content_discovery_events`.
2. Deploy Worker route changes and goal API shape changes.
3. Deploy admin and public UI changes that consume the new fields and endpoints.
4. Update docs and tests together so the new route and schema expectations are documented before implementation is applied.

Rollback strategy:
- Because the schema additions are additive, rollback can disable the new routes and UI without needing to delete data.
- If the public UI must be rolled back, `has_content` can remain present but unused until the feature is re-enabled.

## Open Questions

None blocking. The user has already resolved the main scope decisions around naming, teaser visibility, unlock semantics, analytics behavior, and content limits.