---
name: ux-design
description: UX specification, design direction, interaction patterns, and visual design decisions.
date: 2026-03-17
---

# UX Design

## Design Philosophy

- Every interaction reinforces the "epic journey" narrative — kilometers are steps toward Mount Doom, not abstract data.
- Dark fantasy theme inspired by LOTR cinematic aesthetics. Auth pages use a light theme variant to distinguish public from authenticated views.
- Emotional payoff at milestones: goal detail modals are immersive storytelling moments (image + narrative + congratulations animation).
- Progressive disclosure over completionism — show just enough upcoming goals to motivate without overwhelming (171 total milestones).

## Core UX Rules

- Always complete a walk log in < 30 seconds. The calendar is fixed at the bottom so logging is always one tap away.
- Always show "km to go" on upcoming goal cards — this is the primary motivator.
- Always display quick-entry buttons (+1, +2, +3, +5, +10 km) in the distance entry modal.
- Always show a "km" suffix on distance inputs to eliminate unit confusion.
- Never auto-dismiss error toasts — user must acknowledge errors.
- Never rewrite working legacy vanilla JS in `public/js/` without explicit permission. New UI goes in `client/src/`.
- Show only the last 3 completed goals by default; provide a "Show All Completed" toggle.
- Use gold accent for distance values, headlines, and milestone highlights — it is the signature visual motif.

## Interaction Patterns

### Distance Entry
- Tapping any calendar day opens the distance entry modal for that date.
- Quick-entry buttons are the primary input method; numeric input is the fallback.
- After submission, the calendar cell updates to show logged activity.

### Goal Detail Modal
- Use progressive image loading: low-res thumbnail → high-res with blur-to-sharp CSS transition.
- On newly achieved goals, play the congratulations animation (pulse + glow).
- Modal body must be scrollable for long lore descriptions.

### Map
- Map social panel consolidates fellowship selector + friends toggle in one collapsible panel.
- Always collapse the social panel to an icon button by default to preserve map immersion.
- Friend markers show avatar + username tooltip on tap.
- Map rendering uses Konva.js → `client/src/islands/MapIsland.tsx`.

### Friends & Social
- Friend code landing (`/friends/add/:friendCode`) must redirect unauthenticated users to login, then return them to the add-friend page.
- Pending friend requests always appear at the top of the friends list.
- Badge on the nav link must reflect the pending request count.
- Friend profiles show total distance and current goal for accepted friends only.

### Avatar Selection
- Predefined LOTR-themed avatars only — no user uploads (avoids moderation).
- Current selection highlighted with gold border.
- Avatar thumbnails are 64×64 WebP (`public/img/avatars/thumbs/`); display size 128×128.

## Responsive & Layout Rules

- Mobile-first. Primary breakpoints: 600px and 768px.
- All touch targets must be ≥ 44×44 px (PRD NFR_ACC_02).
- Goals section max-width 700px, centered.
- Calendar is fixed-position at the bottom of the viewport.
- Modals must scroll internally — never let modal content overflow the viewport.

## Accessibility Requirements

- Target WCAG AA contrast. Gold on dark passes; verify all gray text (#888, #aaa) meets ratio.
- Trap focus inside open modals. Return focus to the trigger element on close.
- All interactive elements must be keyboard-navigable.
- Add `aria-label` to icon-only buttons (profile, social panel toggle).

## Animation & Transition Conventions

- Goal image reveal: CSS blur transition from thumbnail to high-res (no JS animation).
- Milestone congratulations: CSS `pulse` + `glow` keyframes on the achievement card.
- Keep all animations under 300ms. Respect `prefers-reduced-motion` — disable non-essential animations.

## Theme Reference

- Colors, variables, and theming rules → [css-theming.md](css-theming.md)
- Component structure and CSS classes → read source in `public/css/` and `client/src/`
- Button variants (primary, secondary, danger, toggle) → defined as CSS classes in stylesheets

## Open Design Items

- **Onboarding flow** — new user first-run experience (not yet designed).
- **Goals list sections** — group 171 milestones by location headers to reduce scroll fatigue.
- **Calendar day labels** — show distance logged directly on day cells.
- **Progress bar** — simple visual under total distance on the dashboard.
