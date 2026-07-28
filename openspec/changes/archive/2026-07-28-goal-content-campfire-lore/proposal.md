## Why

Walk to Mordor currently treats goal descriptions as the only authored milestone reward, which limits how much narrative payoff a reached goal can provide. Epic 16 adds richer goal-attached lore so unlocked goals can feel more rewarding, while locked goals with extra content can tease that reward and create additional motivation to keep walking.

## What Changes

- Introduce authored rich content attached directly to goals, covering campfire stories, poetry, and appendices.
- Add admin management for goal content inside the existing goal editing flow, including Markdown authoring, ordering, preview, and content-type metadata.
- Add public goal content APIs that reuse the exact same unlock state as the goal surface itself, including fellowship progress contexts where the goal is already viewable.
- Extend goal list and card surfaces so goals with extra content advertise that fact, including blurred teaser placeholders for still-locked goals.
- Add GoalModal content presentation for unlocked content with type-aware rendering for stories, poetry, and appendices, including long-form appendix truncation.
- Add lightweight best-effort discovery analytics for teaser impressions and content opens.

## Capabilities

### New Capabilities
- `goal-content`: Authored content attached to goals, including admin management, goal-context unlock behavior, goal-card teasers, modal rendering, and lightweight discovery analytics.

### Modified Capabilities

None.

## Impact

- D1 schema: new goal content table and lightweight content discovery event table.
- Worker APIs: new admin goal-content CRUD endpoints, new public goal-content read endpoints, and `/api/goals` response expansion for content presence.
- Frontend: updates to the existing admin goal editor, goal cards, legacy goals list rendering, and GoalModal content display.
- Dependencies and rendering: reuse existing `marked` and `DOMPurify` client-side Markdown pipeline rather than introducing a separate authoring system.
- Testing and docs: new Jest, Vitest, and Playwright coverage plus updates to API, data-model, architecture, and frontend documentation.