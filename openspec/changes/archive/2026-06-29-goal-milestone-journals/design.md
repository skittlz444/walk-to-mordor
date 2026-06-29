## Context

Walk to Mordor already renders milestone details through one shared `GoalModal`, but the goal data feeding that modal is hybrid: legacy journey goals come from `public/js/goals.js`, newer surfaces come from Preact islands, and fellowship milestone views use separate progress endpoints. The app also no longer treats goals as a single linear route. `storyline_goals` reuses canonical `goals` rows at different distances on different storylines, which means journals cannot be keyed to storyline-specific distances if users are meant to share Rivendell notes across Frodo/Sam and Pippin.

This change is cross-cutting because it adds new D1 data, new Worker routes, new access-control rules that depend on both friendships and milestone visibility preferences, and GoalModal state that must work in personal, map, walk-congratulations, and fellowship contexts. The user has also narrowed MVP scope: no dedicated My Journal page, no archive flow, and no separate journal browsing surface outside GoalModal.

## Goals / Non-Goals

**Goals:**
- Store one plain-text journal entry per user per canonical shared goal.
- Show the same entry across every storyline that reuses that goal.
- Allow individual authoring when the user has reached the goal personally or when the fellowship they are actively viewing has reached it.
- Let GoalModal read the viewer's own entry plus visible friend entries in one request shape that supports the MVP UI directly.
- Apply the user-selected milestone visibility rule to friend-entry reads when previews are locked, while keeping journals plain text and safe to render.
- Reuse the repo's existing Cloudflare Worker, D1, Preact island, and legacy goals patterns without rewriting the journey goals list.

**Non-Goals:**
- No standalone `/journals` page, profile journal archive, or journal list endpoint for MVP.
- No Markdown or rich-text authoring for journal bodies.
- No admin journal management surface.
- No journal analytics or goal-list badges in MVP.
- No per-storyline duplicate journal entries for the same shared goal.

## Decisions

### 1. Journal identity is canonical `goal_id`, not `storyline_goal_id`

`milestone_journals` will be unique on `(user_id, goal_id)`. A journal entry written at Rivendell on one storyline is the same entry shown when that same canonical goal appears on another storyline.

Rationale: the user explicitly wants shared-goal journals across storylines. The repo's storyline system already treats `goals` as reusable canonical milestones and `storyline_goals` as route-specific placement.

Alternatives considered:
- Keying journals by `storyline_goal_id` was rejected because it would create duplicate entries for the same shared destination across storylines.
- Storing both `goal_id` and `storyline_goal_id` in the uniqueness constraint was rejected because it would weaken the cross-storyline sharing rule.

### 2. Use goal-scoped modal APIs instead of generic journal collections in MVP

The MVP API surface will be optimized for GoalModal rather than for a future journal archive page:
- `GET /api/goals/:goalId/journals[?partyId=<id>]` returns the viewer's current journal state for that goal: own entry, visible friend entries, and permission flags needed by GoalModal.
- `PUT /api/goals/:goalId/journal` creates or updates the current user's single journal entry for that goal. Request body includes `body`, `visibility`, and optional `partyId` for fellowship-context write validation.
- `DELETE /api/goals/:goalId/journal` deletes the current user's entry for that goal.

Rationale: there is no My Journal page in MVP, and the modal needs both own-entry state and friend-entry state together. Goal-scoped endpoints avoid extra lookups, avoid journal-id routing churn, and match the one-entry-per-user-per-goal model cleanly.

Alternatives considered:
- Preserving the original `POST /api/journals`, `PUT /api/journals/:id`, `GET /api/journals/mine`, and friends-list endpoints was rejected because it adds round trips and list APIs the MVP will not use.
- A separate `journal-state` endpoint was rejected because the goal-scoped journals route already conveys the right resource context.

### 3. Separate write access from friend-read access, and make both context-aware

Write access and friend-read access will be computed independently.

Write access:
- Allowed when the user has personally reached the canonical goal in their active storyline context.
- Also allowed when the request includes `partyId`, the user is an active member of that fellowship, and the fellowship has reached the same canonical goal in that fellowship storyline context.

Friend-read access:
- Requires accepted friendship in every case.
- If the viewer has milestone previews locked, then the viewer must also have reached the goal in the current reading context before friend entries are returned.
- If the viewer has milestone previews enabled, accepted friendship alone is sufficient for friend-entry reads.

Rationale: this matches the user's clarified product rules and keeps fellowship progress meaningful without forcing users to switch back to personal view just to write.

Alternatives considered:
- Requiring personal reach only for writes was rejected because it conflicts with the clarified fellowship-first play style.
- Requiring viewer reach for every friend read was rejected because the user explicitly wants friendship-only reads when previews are enabled.
- Friendship-only reads in all cases were rejected because they would bypass the viewer's locked-milestone preference.

### 4. Return permission flags with the journal-state response

The goal-scoped read response will include permission booleans such as `canWrite`, `canEditOwn`, `canDeleteOwn`, and `canReadFriends`, plus the viewer's own entry if present and the currently visible friend entries.

Rationale: GoalModal is the only MVP surface. Returning permission state directly keeps the UI deterministic across legacy and island entry points and prevents it from re-deriving complex friendship, preview, and fellowship access rules client-side.

Alternatives considered:
- Making the client infer permissions from raw session and preference state was rejected because modal callers do not all carry the same context.
- Returning 403 for hidden friend entries was rejected because GoalModal still needs to render the rest of the milestone normally.

### 5. Keep journal bodies plain text and render them as text, not HTML

Journal bodies will be trimmed, validated as non-empty plain text up to 2000 characters, and rendered as text nodes with line breaks preserved via `white-space: pre-wrap`. The body itself will never be inserted with `dangerouslySetInnerHTML`.

This change will still follow the sanitization posture established in the adjacent goal-content change: any future helper-generated HTML wrappers or excerpt rendering must use the same safe client-side sanitization standards already being adopted there, but the journal body itself remains plain text only.

Rationale: plain text avoids moderation and XSS complexity while still preserving the safe-rendering standard the repo is converging on.

Alternatives considered:
- Escaping or HTML-encoding on storage was rejected because it couples persistence to presentation and makes future rendering rules harder to reason about.
- Supporting Markdown was rejected because the user explicitly kept journals plain text.

### 6. GoalModal is the only MVP journal surface

This change will extend the shared `GoalModal` used by journey, map, walk-congratulations, and fellowship milestone surfaces. It will not add a My Journal page, profile journal section, or separate browsing flow in MVP.

Rationale: this keeps scope focused on the moment a milestone is experienced and avoids introducing list APIs or archive navigation that the user deferred.

Alternatives considered:
- Adding `/journals` in the same change was rejected because the user explicitly moved it to post-MVP.
- Embedding journal browsing in the profile page was rejected because profile is currently a settings-focused surface, not a content archive.

### 7. Preserve modal context explicitly across callers

Client goal models and modal props will need to preserve enough context for journal reads and writes, specifically canonical `goal_id`, optional `storyline_goal_id`, and optional `partyId` when the modal is opened from a fellowship surface.

Rationale: several current adapters reconstruct lightweight goal objects and would otherwise lose the context needed for correct write validation and friend-read gating.

Alternatives considered:
- Letting GoalModal rediscover all context from global state was rejected because not every caller participates in the same state layer.

## Risks / Trade-offs

- [Shared goals at different storyline distances may surprise users] → Mitigation: treat the journal as belonging to the canonical destination, not the distance marker, and keep wording in docs and tests aligned with that model.
- [GoalModal callers currently drop context fields] → Mitigation: update shared goal typings and modal props before wiring journal fetches so every caller carries canonical goal and optional fellowship context consistently.
- [Friend-read rules depend on user preference state] → Mitigation: compute permission flags server-side and let the UI hide the friends section when `canReadFriends` is false.
- [Concurrent GoalModal changes from adjacent content work] → Mitigation: keep the journal state contract self-contained and coordinate around a single modal fetch lifecycle rather than separate duplicated loaders.
- [Fellowship-based write access can outlive later personal progress changes] → Mitigation: journal ownership is personal and durable once created; only creation and updates are gated by current access rules.

## Migration Plan

1. Add an additive D1 migration for `milestone_journals` with uniqueness, visibility validation, timestamps, and indexes optimized for goal-scoped reads.
2. Add Worker journal handlers and route-method registration in `src/index.ts`.
3. Widen shared goal and modal context types so GoalModal can receive canonical goal identity plus optional fellowship context.
4. Extend GoalModal to fetch goal-scoped journal state, render own-entry authoring or read mode, and show visible friend entries.
5. Add backend, client, and Playwright coverage, then update data-model, API, frontend, and architecture docs.

Rollback strategy: the schema addition is additive. If the UI or routes must be rolled back, the Worker can stop exposing the journal endpoints and the modal can stop fetching journal state without requiring data deletion.

## Open Questions

None blocking for MVP. Future work can decide whether to surface route-origin metadata, journal archive browsing, or goal-list journal indicators once the modal-first flow is established.