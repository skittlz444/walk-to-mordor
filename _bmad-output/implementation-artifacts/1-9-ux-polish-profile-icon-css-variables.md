# Story 1.9: UX Polish - Profile Icon & CSS Variables

Status: ready-for-dev
Issue: #160

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Frodo (Story-Driven Walker)**,
I want **a consistent, thematic interface with a recognizable profile icon**,
so that **the application feels polished, immersive, and I can easily access my settings**.

## Acceptance Criteria

1.  **CSS Variable System**:
    *   Define a comprehensive color palette as CSS custom properties (`:root`) in `public/css/main.css`.
    *   Variables must include: Primary (Gold), Backgrounds (Dark/Black), Accents (Blue, Teal), Text colors, and Status colors (Error, Success).
    *   Replace hardcoded hex values in `main.css` (and other CSS files if practical) with these variables.
2.  **Profile Button Replacement**:
    *   Replace the existing specific "Profile" text button in the header.
    *   Implement a **Circular Avatar/Icon** button (minimum 44x44px target).
    *   **Fallback**: If no user avatar image is available (current state), display User Initials (e.g., "F" for Frodo Baggins) or a default generic SVG silhouette icon.
    *   Button must link to the existing `/profile` route.
3.  **Thematic Consistency**:
    *   Ensure the new element style aligns with the dark fantasy / LOTR theme (e.g., gold border, dark background).
    *   Maintain WCAG AA contrast compliance for the icon/text.

## Tasks / Subtasks

- [x] **CSS Architecture (`public/css/main.css`)**
  - [x] Analysis: Audit `main.css` to collect all used hex codes.
  - [x] Implementation: Define `:root` block with semantic variable names (e.g., `--color-accent-gold: #FFD700`).
  - [x] Refactor: Replace hardcoded colors with `var(--variable-name)`.

- [x] **Profile Button Implementation (`src/renderHtml.ts`)**
  - [x] Locate the header rendering logic (likely in `renderHtml` or a helper).
  - [x] Update the HTML generation for the profile link.
  - [x] Logic: Extract initials from `user.name` (if available) or use default.
  - [x] Markup: Change to `<a href="/profile" class="profile-icon" aria-label="Profile">...</a>`.

- [x] **Profile Button Styling (`public/css/main.css` or `public/css/header.css`)**
  - [x] Create `.profile-icon` class.
  - [x] Styles: `border-radius: 50%`, `display: flex`, `justify-content: center`, `align-items: center`, `width/height: 40px`.
  - [x] Colors: Use the new CSS variables (e.g., Gold border, dark background).

## Dev Notes

### Reference Color Palette (from UX Design)
- **Background (Primary)**: `#000000` (`--bg-primary`)
- **Background (Secondary)**: `#1a1a1a` (`--bg-secondary`)
- **Accent (Gold)**: `#FFD700` (`--text-gold`)
- **Accent (Blue)**: `#007bff` (`--accent-blue`)
- **Accent (Teal)**: `#16c79a` (`--accent-teal`)
- **Text (White)**: `#ffffff` (`--text-primary`)
- **Text (Gray)**: `#ccc` (`--text-secondary`)

### Project Structure Notes
- **Header Logic**: The header HTML is likely generated in `src/renderHtml.ts` (SSR). Ensure this file is updated, not just client-side JS.
- **Legacy JS**: Be careful not to break any legacy JS that might query the "Profile" button by ID or class if it does (unlikely, but check).
- **Icons**: Prefer SVG inline or simple CSS text (Initials) to avoid adding new image assets if possible.

### File Locations
- Styles: `public/css/main.css` for variables.
- HTML Generation: `src/renderHtml.ts`.

### References
- [UX Design Specification](docs/ux-design.md#current-design-system)
- [Epic 1 Definitions](_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record

### Agent Model Used
Gemini 3 Pro (Preview)

### Debug Log References
- No debug logs necessary for story creation.

### Completion Notes List
- Story creates a foundation (CSS vars) for easier theming in future phases.
- Profile icon improves mobile space usage in header.

### File List
- public/css/main.css
- src/renderHtml.ts
