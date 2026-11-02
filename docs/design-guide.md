---
name: design-guide
description: Visual design system, CSS theming, UX patterns, and interaction conventions.
---

# Design Guide

*Last updated: 2026-11-02*

## Design Philosophy

- Dark fantasy theme inspired by LOTR cinematic aesthetics. Every interaction reinforces the "epic journey" narrative.
- Auth pages use a light-theme variant (`--light-*` vars) to distinguish public from authenticated views.
- Gold accent is the signature visual motif — use for distance values, headlines, and milestone highlights.
- Emotional payoff at milestones: goal detail modals are immersive storytelling moments (image + narrative + congratulations animation).
- Progressive disclosure over completionism — show just enough upcoming goals to motivate.
- Mobile-first. Always complete a walk log in < 30 seconds.

## CSS Architecture

- All CSS custom properties live in `:root` in `public/css/main.css`. Read that file for current values — not duplicated here.
- **Never hardcode hex/rgb values.** Always use `var(--variable-name)`.
- **No inline styles** in HTML templates — use classes that reference variables.
- **No CSS-in-JS.** Preact islands use CSS classes from domain stylesheets.
- Variable naming: prefix by role, not color (`--bg-primary`, `--text-muted`, `--status-error`).
- Semantic hierarchy: `-primary`, `-secondary`, `-muted`, `-dim` for intensity levels.
- State variants: append `-hover`, `-light`, `-dark`, `-alt`.
- Overlay/glow scale: `-light`, `-medium`, `-strong` (e.g. `--gold-glow-light`).
- Domain scoping: auth light-theme vars use `--light-*` prefix.

### File Organization

| File | Owns |
|---|---|
| `public/css/main.css` | Variable definitions, stylesheet imports, base layout |
| `public/css/calendar.css` | Calendar component |
| `public/css/progress.css` | Progress tracking and modals |
| `public/css/goals.css` | Goals display and interactions |
| `public/css/profile.css` | Profile page |
| `public/css/auth.css` | Authentication pages (light theme) |
| `public/css/party.css` | Fellowship/party pages |
| `public/css/friends.css` | Friends feature |
| `public/css/badge-display.css` | Earned badge grid (profile and friend profile) |
| `public/css/badge-award.css` | Badge award modal (global) |

- Each domain stylesheet owns its component styles. Do not put calendar styles in `main.css`.
- `main.css` imports all domain stylesheets and defines variables + base layout only.
- New features get their own stylesheet added to `main.css` imports.
- Page renderers (`src/render*.ts`) explicitly declare which stylesheets load. A class styled in `friends.css` won't apply on a page that only loads `party.css`.

## Component Patterns

### Distance Entry
- Tapping a calendar day opens the distance entry modal. Quick-entry buttons (+1, +2, +3, +5, +10 km) are primary; numeric input is fallback.
- Always show a "km" suffix on distance inputs to eliminate unit confusion.
- After submission, the calendar cell updates to show logged activity.

### Goal Cards & Detail Modal
- Always show "km to go" on upcoming goal cards — this is the primary motivator.
- Show only the last 3 completed goals by default; provide a "Show All Completed" toggle.
- Goal detail modal: progressive image loading (low-res thumbnail → high-res with blur-to-sharp CSS transition).
- On newly achieved goals, play congratulations animation (pulse + glow).
- Modal body must be scrollable for long lore descriptions.

### Avatar Selection
- Predefined LOTR-themed avatars only — no user uploads (avoids moderation).
- Current selection highlighted with gold border.
- Thumbnails: 64×64 WebP (`public/img/avatars/thumbs/`); display size 128×128.

### Friends & Social
- Friend code landing (`/friends/add/:friendCode`) must redirect unauthenticated users to login, then return them to the add-friend page.
- Pending requests always appear at top of friends list. Badge on nav link reflects pending count.
- Friend profiles show total distance and current goal for accepted friends only.

### Badge Grid (Profile & Friend Profile)
- Card anatomy, top to bottom: circular artwork → badge name → meta pills (rank label, collection position `index/size`, repeat count `×N` when `earned_count > 1`).
- Artwork is a circular image (`aspect-ratio: 1 / 1`, `object-fit: contain`). A null, malformed, or failed `image_slug` falls back to a dashed circular CSS placeholder — never an extra asset.
- Grid is `repeat(auto-fill, minmax(96px, 1fr))` with a 0.75rem gap; cards fill their column and keep a square art well.
- Collections render one section per collection, ordered by `collection.index`; the header is `label · earned/size`, with the label in `--accent-gold` and progress in `--text-secondary` over a `--border-gray` rule. Standalone badges trail in an "Other" section, newest-earned first.
- Rank palette maps label → artwork boss material: 1 bronze, 2 silver, 3 gold, 4 mithril. The rank pill uses the gold accent tokens (`--accent-gold`, `--gold-border-light`, `--gold-glow-light`) at every rank — rank distinction lives in the baked boss artwork, not in CSS color.
- **Rank and collection numbers are text, never baked into artwork.** Text stays crisp at every size, is localizable, and is readable by assistive technology.
- Loading: eight circular `--bg-dark-alt` shimmer skeletons render only after a ~175 ms delay so fast responses never flash; disable the shimmer under `prefers-reduced-motion`.
- Artwork tiers: 512 px cards, 200 px thumbs (`-thumb` suffix), 1024 px inspection assets under `full/`. Repeatable badges ship one variant per rank (`<image_slug>--<rank_label>`); fixed-rank badges use `<image_slug>`.
- Card activation: each earned card is a native button (`.badge-card__button`) whose accessible name includes rank, collection position, and repeat count; activating it dispatches `wtm:open-badge-modal` and opens the award modal view-only. The button reset and focus ring live in `badge-display.css`; the modal owns the rest.
- Stylesheet: `public/css/badge-display.css`. It is loaded on both `/profile` and `/friends/:userId`.

### Badge Award Modal
- One globally mounted `BadgeAwardModal` island serves two modes: **acknowledge** (pending awards fetched on page open, including the map) and **view-only** (opened by activating any earned badge card through the `wtm:open-badge-modal` document event). Never import the grid from the modal or the modal from the grid.
- Dialog semantics: overlay + dialog with `role="dialog"`, `aria-modal="true"`, and the badge name as `aria-label`. Focus moves into the dialog on open (primary action first in acknowledge mode) and returns to the activating card on close. Trap focus while open; Escape and overlay activation close.
- Queue behavior: one award at a time, oldest first, with "Badge x of n" exposed to assistive technology. The primary action acknowledges the shown instance and advances; the last award closes the modal and the queue does not reopen in that page view.
- Repeatability-aware dismiss: closing a repeatable award acknowledges it so it does not nag; closing a one-off award does **not** acknowledge, so it stays pending for a later visit. A failed acknowledgement keeps the same badge with a retry control and blocks advancement/close.
- View-only mode never acknowledges and never fetches pending awards. It preserves any in-memory pending queue and resumes it after closing. Friend-profile badges are always view-only.
- Artwork: 200 px thumbnail first, then the 1024 px `full/<name>.webp` crossfades in. Repeatables use the **awarding** rank label in acknowledge mode (`<image_slug>--<rank_label>`) and the grid's **current** rank in view-only mode; fixed-rank badges use `<image_slug>`. Apply the badge grid's slug validation and fallback chain; invalid artwork renders text only.
- Defer the acknowledge modal only while another real modal dialog is open; the map page is not a modal and never blocks it.
- Respect `prefers-reduced-motion` — disable entrance and celebration transitions. Style with design variables only; never hardcode colors.
- Stylesheet: `public/css/badge-award.css`, loaded globally by `src/renderLayout.ts`.

### Toast
- Never auto-dismiss error toasts — user must acknowledge errors.

## Responsive Breakpoints

- **768px** — tablet/mobile boundary; layout shifts across most components.
- **600px** — secondary breakpoint for goals and social layouts.
- **480px** — small mobile; tighter spacing and font adjustments.
- All touch targets ≥ 44×44 px (PRD NFR_ACC_02).
- Goals section max-width 700px, centered. Calendar fixed at viewport bottom.
- Modals scroll internally — never let content overflow the viewport.
- Breakpoints are inline per domain stylesheet (not centralized) because each component has different layout needs.

## Map UX

- Rendering: Konva.js → `client/src/islands/MapIsland.tsx`.
- Social panel consolidates fellowship selector + friends toggle in one collapsible panel.
- Always collapse the social panel to an icon button by default to preserve map immersion.
- Friend markers show avatar + username tooltip on tap.

## Animation & Motion

- Goal image reveal: CSS blur transition from thumbnail to high-res (no JS animation).
- Milestone congratulations: CSS `pulse` + `glow` keyframes on the achievement card.
- Keep all animations under 300ms.
- Respect `prefers-reduced-motion` — disable non-essential animations.

## Accessibility

- Target WCAG AA contrast. Gold on dark passes; verify all gray text (#888, #aaa) meets ratio.
- All color pairings must meet WCAG AA minimum contrast ratios.
- Trap focus inside open modals. Return focus to the trigger element on close.
- All interactive elements must be keyboard-navigable.
- Add `aria-label` to icon-only buttons (profile, social panel toggle).

## Page Layout Patterns

- Server-rendered shell + Preact islands. Islands are rendered inside HTML that already loads appropriate stylesheets.
- If an island needs styles from a stylesheet not loaded by its host page, update the page renderer to include it.
- Never rewrite working legacy vanilla JS in `public/js/` without explicit permission. New UI → `client/src/`.

## Pitfalls

- Hardcoding colors instead of using CSS variables.
- Adding styles to an unrelated domain stylesheet.
- Forgetting to update `src/render*.ts` when an island needs a new stylesheet.
- Assuming a stylesheet is loaded when it isn't — check the page renderer.
- Auto-dismissing error toasts.
- Ignoring `prefers-reduced-motion`.

## Open Design Items

- **Onboarding flow** — new user first-run experience (not yet designed).
- **Goals list sections** — group milestones by location headers to reduce scroll fatigue.
- **Calendar day labels** — show distance logged directly on day cells.
- **Progress bar** — simple visual under total distance on the dashboard.

## Related Docs

- [Frontend Guide](frontend-guide.md) — frontend architecture and islands pattern
- [Architecture](architecture.md) — system architecture and component structure
