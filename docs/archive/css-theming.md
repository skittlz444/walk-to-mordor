---
name: css-theming
description: Theme variables, styling conventions, and CSS organization rules.
---

# CSS Theming Guide

*Last updated: 2026-03-17*

## Theme Variable Location

All CSS custom properties are defined in the `:root` selector in `public/css/main.css`. Read that file for current values — they are not duplicated here.

Variables are grouped by category: backgrounds (`--bg-*`), accents (`--accent-*`), text (`--text-*`), status (`--status-*`), borders (`--border-*`), overlays/glows, and light-theme variants (`--light-*`).

## Naming Conventions

- **Prefix by role**, not color: `--bg-primary`, `--text-muted`, `--status-error` — not `--dark-black` or `--red`.
- **Semantic hierarchy**: use `-primary`, `-secondary`, `-muted`, `-dim` for intensity levels.
- **State variants**: append `-hover`, `-light`, `-dark`, `-alt` for interactive/variant states.
- **Overlay/glow scale**: use `-light`, `-medium`, `-strong` (e.g. `--gold-glow-light`).
- **Domain scoping**: auth-page light-theme vars use `--light-*` prefix.

## Styling Rules

- **Never hardcode hex/rgb values.** Always use `var(--variable-name)`.
- **Contrast**: all color pairings must meet WCAG AA minimum contrast ratios.
- **New variables**: add to the appropriate category group in `public/css/main.css` `:root`. Follow existing naming patterns.
- **No inline styles** in HTML templates — use classes that reference variables.

## File Organization

| File | Owns |
|---|---|
| `public/css/main.css` | All CSS variable definitions, stylesheet imports, base layout |
| `public/css/calendar.css` | Calendar component |
| `public/css/progress.css` | Progress tracking and modals |
| `public/css/goals.css` | Goals display and interactions |
| `public/css/profile.css` | Profile page |
| `public/css/auth.css` | Authentication pages (light theme) |
| `public/css/party.css` | Fellowship/party pages |
| `public/css/friends.css` | Friends feature |

### Ownership Rules

- Each domain stylesheet owns its component styles. Do not put calendar styles in `main.css`.
- `main.css` imports all domain stylesheets and defines the variables + base layout only.
- New features get their own stylesheet added to `main.css` imports. Do not add styles to an unrelated file.
- Page renderers (`src/render*.ts`) explicitly declare which stylesheets a page loads. A class styled in `friends.css` will not apply on a page that only loads `party.css`.

## Responsive Breakpoints

- **768px** — tablet/mobile boundary. Used across most components for layout shifts.
- **480px** — small mobile. Used for tighter spacing and font adjustments.
- Breakpoints are defined inline in each domain stylesheet (not centralized) because each component has different layout needs at each breakpoint.

## Preact Component Styling

- Preact islands in `client/src/` should use CSS classes from the domain stylesheets, not inline styles or CSS-in-JS.
- Islands are rendered inside server-rendered HTML that already loads the appropriate stylesheets.
- If an island needs styles from a stylesheet not loaded by its host page, the page renderer must be updated to include it.

## Related Docs

- [Frontend Guide](frontend-guide.md) — frontend architecture and islands pattern
- [UI Overview](ui-overview.md) — component structure and behavior
- [UX Design](ux-design.md) — design principles and patterns
