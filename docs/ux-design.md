---
stepsCompleted: [1]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/product-brief-walk-to-mordor-2026-01-14.md
  - docs/index.md
  - docs/ui-overview.md
date: 2026-01-15
author: Hayden
scope: existing-design-documentation
---

# UX Design Specification: Walk to Mordor

**Author:** Hayden
**Date:** 2026-01-15
**Scope:** Document existing design patterns, identify improvements for current UI

---

## Executive Summary

### Project Vision

Walk to Mordor transforms the mundane act of daily walking into an epic journey through Middle-earth. The UX strategy centers on **emotional resonance** - every kilometer logged isn't just data, it's a step closer to Mount Doom. The current MVP successfully implements this vision through a dark, atmospheric interface that evokes the world of Tolkien while maintaining functional simplicity for quick activity logging.

### Target Users

| Persona | Context | Core Need |
|---------|---------|-----------|
| **Samwise** (Consistent Walker) | Daily dog walks, commutes | Add "magic" to routine - feel like part of something bigger |
| **Bilbo** (Reluctant Adventurer) | Sedentary, needs motivation | Strong narrative hook to start moving |
| **Strider** (Power User) | Runner, logs serious mileage | Visualize progress against epic scale |
| **Aragorn** (Fellowship Leader) | Social organizer | Group accountability (future) |
| **Gandalf** (System Admin) | Developer/maintainer | Zero-maintenance operation, lore fidelity |

### Key Design Challenges

1. **Quick Logging Friction** - Users must log walks in <30 seconds (PRD requirement)
2. **Long List Management** - 171 milestones creates potential information overload
3. **Motivation Sustain** - Early journey shows small progress against massive distance
4. **Theme Consistency** - Balance dark atmospheric theme with usability

### Design Opportunities

1. **Milestone Celebrations** - Leverage emotional payoff of reaching each goal
2. **Visual Storytelling** - Rich imagery creates deeper narrative connection
3. **Progressive Disclosure** - Show just enough upcoming goals to motivate without overwhelming

---

## Current Design System

### Color Palette

The application employs a **dark fantasy theme** inspired by Lord of the Rings cinematic aesthetics:

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Background (Primary)** | Black | `#000000` | Body background |
| **Background (Secondary)** | Dark Gray | `#1a1a1a` | Cards, modals, calendar |
| **Accent (Primary)** | Gold | `#FFD700` | Headlines, distance values, special milestones |
| **Accent (Secondary)** | Blue | `#007bff` | Today indicator, focus states |
| **Accent (Tertiary)** | Teal Green | `#16c79a` | Success states, button hovers |
| **Text (Primary)** | White | `#ffffff` | Main content |
| **Text (Secondary)** | Gray | `#ccc` / `#aaa` | Labels, secondary info |
| **Text (Muted)** | Dark Gray | `#888` | Completed/struck items |
| **Error** | Red | `#ff6b6b` / `#dc3545` | Error messages |
| **Success** | Green | `#00FF7F` / `#51cf66` | Congratulations, success messages |

> [!NOTE]
> The auth pages use a **light theme variant** with white card backgrounds and darker text, creating visual distinction between authenticated and public-facing sections.

### Typography

| Element | Font | Size | Weight | Notes |
|---------|------|------|--------|-------|
| **Body** | System stack | Base | 400 | `-apple-system, "Segoe UI", Roboto, sans-serif` |
| **H1 (Dashboard)** | System stack | 2.2em | Bold | Gold with text-shadow |
| **Total Distance** | System stack | 1.7em | Bold | White, letter-spacing: 2px |
| **Calendar Title** | System stack | 1.625em | 300 | Light weight for elegance |
| **Modal Title** | System stack | 1.2em | Bold | White |
| **Goal Cards** | System stack | 1.1em | Bold | White title, gold distance |

### Spacing & Layout

- **Mobile-First:** Primary breakpoints at 768px and 600px
- **Container Width:** Goals section max-width 700px, centered
- **Calendar:** Fixed position at bottom (z-index: 100)
- **Touch Targets:** 44x44px minimum (per PRD NFR_ACC_02)
- **Modal Padding:** 1rem consistent throughout

### Component Library

#### 1. Calendar (Fixed Bottom)

The calendar is the primary interaction point for logging walks.

**Structure:**
- Header with month/year navigation
- Week/Month view toggle
- 7-column grid for days
- Today cell highlighted with blue tint

**Behavior:**
- Clicking any day opens the distance entry modal
- Days with logged activity show event label
- Other-month days shown at 40% opacity

#### 2. Goal Cards

Two visual states based on completion:

**Completed Goals:**
- Strike-through text styling
- Gray (#888) coloring
- Shows last 3 by default with "Show All Completed" toggle

**Upcoming Goals:**
- Dark card background (`rgba(40,40,40,0.95)`)
- Border-radius: 12px
- Box-shadow for depth
- Gold distance with "km to go" indicator

#### 3. Modals

**Distance Entry Modal:**
- Semi-transparent overlay (`rgba(0,0,0,0.5)`)
- Dark card (#1a1a1a, no border-radius)
- Date display + numeric input
- Add/Cancel buttons (text-only, no button styling)

**Goal Detail Modal:**
- Scrollable body for long descriptions
- Progressive image loading (thumb → high-res with blur transition)
- Justified text for narrative descriptions
- Congratulations animation (pulse + glow) on achievement

#### 4. Buttons

| Type | Background | Use Case |
|------|------------|----------|
| Primary | `#007bff` / `#0f3460` | Submit actions |
| Secondary | `#6c757d` | Cancel, dismiss |
| Danger | `#dc3545` | Delete actions |
| Toggle | `#333` | Filter toggles |
| Profile | `#006048` (header) | Profile access |

> [!WARNING]
> **Inconsistency Found:** Profile button defined differently in `main.css` (`#006048`) vs `profile.css` (`#16c79a`). The teal from profile.css appears to be intended but may be overridden.

> [!IMPORTANT]
> **Profile Button UX Issue:** The current "Profile" text button in the header is poor UX. It's positioned in the corner where users don't naturally look, and the text label takes up unnecessary space. **Recommended improvement:** Replace with a circular avatar/icon button (user silhouette or initials) that is more universally recognized and space-efficient. Consider placing it in a hamburger menu or bottom navigation bar for mobile-first design.

---

## Current UI Screens

### 1. Login Page

**Observations:**
- Clean centered card design on dark gradient background
- Blue glow effect on title creates thematic atmosphere
- White card provides clear visual separation
- Login button uses dark blue (`#0f3460`)
- Links for password reset and registration clearly visible

**What Works:**
- ✅ Clear visual hierarchy
- ✅ Thematic atmosphere established immediately
- ✅ Standard, recognizable auth pattern

**Improvement Opportunities:**
- Consider adding subtle LOTR imagery or map background
- "Walk to Mordor" title could use a more fantasy-appropriate font for the brand

### 2. Main Dashboard

**Observations:**
- Gold "Total distance travelled" headline is impactful
- Large white distance number (40.15 km) is the focal point
- Last completed goal shown below with strike-through
- Goals list provides scrollable journey view
- Fixed calendar at bottom enables quick logging

**What Works:**
- ✅ Clear information hierarchy (total → current goal → list → calendar)
- ✅ Fixed calendar ensures logging is always accessible
- ✅ Gold accents feel premium and thematic

**Improvement Opportunities:**
- Long goals list can push important content above viewport
- No visual progress bar or journey visualization
- Completed goals section toggles could be more intuitive

### 3. Goals List

**Observations:**
- Completed goals displayed with strike-through + gray text
- Upcoming goals as prominent cards with gold distance
- "km to go" calculation provides motivation
- Toggle buttons allow hiding/showing completed

**What Works:**
- ✅ Clear visual distinction between completed and upcoming
- ✅ "X km to go" text provides motivational context
- ✅ Cards are touch-friendly with good hit areas

**Improvement Opportunities:**
- Very long list (171 goals) could benefit from section headers by location
- Next immediate goal could be more visually prominent
- Consider collapsing distant future goals

### 4. Distance Entry Modal

**Observations:**
- Simple modal with date + numeric input
- Add/Cancel buttons lack button styling (just text)
- No units indicator on the input field

**What Works:**
- ✅ Minimal friction - just enter a number
- ✅ Date context shown clearly

**Improvement Opportunities:**
- Add "km" label next to or inside input field
- Buttons should have more visible styling for better affordance
- Consider increment buttons (+1km, +5km) for quick entry
- Placeholder showing last entry could speed up repeat logging

### 5. Goal Detail Modal

**Observations:**
- Rich modal with image, description, and distance
- Progressive image loading with blur-to-sharp transition
- Justified text for narrative descriptions
- Congratulations animation on newly achieved goals

**What Works:**
- ✅ Immersive storytelling moment
- ✅ High-quality imagery rewards exploration
- ✅ Scrollable for long descriptions

**Improvement Opportunities:**
- Could add "Share" functionality for milestone achievements
- Previous/Next navigation to browse adjacent milestones
- Reading progress indicator for long descriptions

---

## Recommended Improvements

### Priority 1: Quick Wins (Low Effort, High Impact)

| Issue | Current State | Recommendation | Impact |
|-------|--------------|----------------|--------|
| Modal button styling | Text-only buttons | Add background color + padding matching auth buttons | Higher affordance |
| Distance input clarity | No units shown | Add "km" suffix or placeholder | Reduces confusion |
| Profile button color | Inconsistent between CSS files | Standardize to teal `#16c79a` | Visual consistency |
| Next goal emphasis | Same styling as other upcoming | Make first upcoming goal larger/highlighted | Clearer immediate target |

### Priority 2: Medium Effort Improvements

| Area | Recommendation | Rationale |
|------|---------------|-----------|
| **Goals List** | Add section headers (e.g., "The Shire", "Bree", "Rivendell") | Breaks up 171-item list, provides journey context |
| **Dashboard** | Add simple progress bar under total distance | Visual representation of overall journey progress |
| **Quick Entry** | Add +1km / +5km quick buttons in modal | Speed up repeat logging for common distances |
| **Calendar Events** | Show distance logged on day cells (not just event) | At-a-glance history without clicking |

### Priority 3: Design System Cleanup

1. **Consolidate Inline Styles:** `goals.js` uses extensive inline styles. Extract to CSS classes for maintainability.
2. **CSS Variable System:** Define color palette as CSS custom properties for easier theming.
3. **Button Component Standardization:** Create consistent button classes used across all modals.
4. **Responsive Refinement:** Calendar header wraps awkwardly at 600px breakpoint.

---

## Accessibility Compliance

**Current Status (per PRD requirements):**

| Requirement | Status | Notes |
|------------|--------|-------|
| NFR_ACC_01: WCAG AA contrast | ⚠️ Partial | Gold on dark passes, but some gray text may not |
| NFR_ACC_02: 44x44px touch targets | ✅ Pass | Calendar cells and buttons meet minimum |
| Keyboard navigation | ⚠️ Unknown | Not explicitly tested |
| Screen reader support | ⚠️ Unknown | Modal focus management needs verification |

**Recommended Accessibility Audit:**
- Run automated WCAG checker on all screens
- Verify modal focus trapping
- Test keyboard-only navigation flow
- Review all gray (#888, #aaa) text for contrast compliance

---

## Mobile-First Validation

**Tested at:** 390x844 (iPhone 14)

| Aspect | Result |
|--------|--------|
| Layout | ✅ Fully responsive, no horizontal scroll |
| Touch targets | ✅ All interactive elements accessible |
| Calendar usability | ✅ Readable, day cells tappable |
| Modal display | ✅ Properly sized with scroll when needed |
| Text readability | ✅ Font sizes appropriate for mobile |

---

## Next Steps

This document establishes the baseline for Walk to Mordor's current UX. The following topics should be addressed in separate design workshops:

1. **Map Visualization (Phase 2)** - Interactive journey visualization
2. **Fellowship Features (Phase 3)** - Multiplayer/social UX patterns
3. **Onboarding Flow** - New user first-run experience
4. **Dark Mode Refinement** - Formalized theme system with potential light mode

---

<!-- UX design content will be appended sequentially through collaborative workflow steps -->
