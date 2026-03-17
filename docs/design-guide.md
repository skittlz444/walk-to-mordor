---
name: design-guide
description: Visual design system, CSS theming, UX patterns, and interaction conventions.
---

# Design Guide

*Last updated: 2026-03-17*

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
| `public/css/profile.css` | Profile modal |
| `public/css/auth.css` | Authentication pages (light theme) |
| `public/css/party.css` | Fellowship/party pages |
| `public/css/friends.css` | Friends feature |

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
