# Frontend Development Guide

This guide explains how to work with the Preact-based frontend in the Walk to Mordor project using the **Islands Architecture** pattern.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Getting Started](#getting-started)
3. [Creating a New Island](#creating-a-new-island)
4. [State Management with Signals](#state-management-with-signals)
5. [Build System](#build-system)
6. [Testing](#testing)

---

## Architecture Overview

### Islands Architecture

Walk to Mordor uses an **Islands Architecture** approach, which means:

- The Cloudflare Worker renders HTML pages server-side
- Specific sections of the page are "islands" of interactivity powered by Preact
- Islands hydrate independently when the page loads
- This provides excellent performance while maintaining interactivity where needed

**Key Principle**: We are NOT building a Single Page Application (SPA). The server controls routing and page structure, while Preact handles interactive widgets.

### Technology Stack

- **Framework**: [Preact](https://preactjs.com/) (~3KB React alternative)
- **State Management**: [@preact/signals](https://preactjs.com/guide/v10/signals/) (built-in reactivity)
- **Build Tool**: [Vite](https://vitejs.dev/) (fast, optimized builds)
- **Language**: TypeScript (strict mode)
- **Future**: React compatibility aliases configured for Konva.js (map feature)

### Project Structure

```
client/                     # Frontend Source
├── src/
│   ├── components/         # Reusable Preact components
│   ├── islands/            # Island entry points (mounted on pages)
│   ├── stores/             # Global state with Signals
│   ├── utils/              # Frontend utilities
│   ├── index.tsx           # Main hydration script
│   └── vite-env.d.ts       # Vite type definitions
├── tsconfig.json           # TypeScript config for client
└── vite.config.ts          # Vite build configuration

public/js/client/           # Build output (served by Worker)
├── islands.js              # Main bundle
├── chunks/                 # Code-split chunks
└── assets/                 # CSS and other assets
```

---

## Getting Started

### Prerequisites

Node.js and npm are installed (already configured in the project).

### Development Workflow

1. **Install dependencies** (already done if you've run `npm install`):
   ```bash
   npm install
   ```

2. **Build the client** (one-time build):
   ```bash
   npm run build:client
   ```

3. **Development mode** (watch for changes):
   ```bash
   npm run dev:client
   ```
   This runs Vite in watch mode, rebuilding when you save files.

4. **Run the full application**:
   ```bash
   npm run dev
   ```
   This starts the Cloudflare Worker dev server with the built client assets.

---

## Creating a New Island

### Step 1: Create the Island Component

Islands live in `client/src/islands/` and are PascalCase `.tsx` files.

**Example**: `client/src/islands/GoalCard.tsx`

```tsx
import { useSignal } from '@preact/signals';

export function GoalCard() {
  const isExpanded = useSignal(false);

  return (
    <div className="goal-card">
      <h3>Next Goal: Rivendell</h3>
      <button onClick={() => isExpanded.value = !isExpanded.value}>
        {isExpanded.value ? 'Collapse' : 'Expand'}
      </button>
      {isExpanded.value && (
        <p>A hidden valley in the Misty Mountains...</p>
      )}
    </div>
  );
}
```

### Step 2: Register the Island

Add your island to the registry in `client/src/index.tsx`:

```tsx
import { GoalCard } from './islands/GoalCard';  // Import your island
import { AuthForms } from './islands/AuthForms';
import { GoalModal } from './islands/GoalModal';

// Auto-hydrated islands - these are rendered from data-island attributes
const autoHydratedIslands = {
  AuthForms,
  GoalCard,  // Add to auto-hydrated registry if it should auto-mount via data-island
};

// All islands including those rendered programmatically
const allIslands = {
  AuthForms,
  GoalCard,
  GoalModal,
};
```

### Step 3: Mount the Island in HTML

In your Worker's HTML rendering code (e.g., `src/renderHtml.ts`), add a mount point:

```html
<div data-island="GoalCard"></div>
```

The `data-island` attribute tells the hydration script which component to render.

### Step 4: Load the Islands Bundle

Make sure the page includes the islands script:

```html
<script type="module" src="/js/client/islands.js"></script>
```

The hydration script automatically finds all `[data-island]` elements and mounts the corresponding components.

---

## State Management with Signals

Preact Signals provide reactive state management without complex patterns.

### Local State (Component-Scoped)

Use `useSignal` for state that only matters within a component:

```tsx
import { useSignal } from '@preact/signals';

export function Counter() {
  const count = useSignal(0);
  
  return (
    <div>
      <p>Count: {count.value}</p>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
}
```

**Key Points**:
- Access value with `.value`
- Mutations are reactive (component auto-updates)
- No need for `setState` or reducers

### Global State (Cross-Component)

For state shared between islands, create a store in `client/src/stores/`:

**Example**: `client/src/stores/progressStore.ts`

```tsx
import { signal, computed } from '@preact/signals';

// Define signals
export const totalDistance = signal<number>(0);
export const currentGoalId = signal<number | null>(null);

// Computed values (auto-update when dependencies change)
export const kilometersRemaining = computed(() => {
  return 1779 - totalDistance.value;
});

// Update functions
export function updateDistance(distance: number) {
  totalDistance.value = distance;
}

export function setCurrentGoal(goalId: number) {
  currentGoalId.value = goalId;
}
```

**Usage in Components**:

```tsx
import { totalDistance, kilometersRemaining } from '../stores/progressStore';

export function ProgressDisplay() {
  return (
    <div>
      <p>Total: {totalDistance.value} km</p>
      <p>Remaining: {kilometersRemaining.value} km</p>
    </div>
  );
}
```

### Effect Signals

Use `effect` to react to signal changes:

```tsx
import { signal, effect } from '@preact/signals';

const distance = signal(0);

effect(() => {
  console.log(`Distance updated: ${distance.value} km`);
  // This runs whenever `distance` changes
});
```

---

## Build System

### Vite Configuration

Build settings are in `client/vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      // Required for react-konva (future map feature)
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
  build: {
    outDir: '../public/js/client',
    emptyOutDir: true,
    rollupOptions: {
      input: './src/index.tsx',
      output: {
        entryFileNames: 'islands.js',
      },
    },
  },
});
```

**Key Features**:
- **Preact Plugin**: Optimizes Preact builds
- **React Aliases**: Allows using React libraries (e.g., `react-konva`) with Preact
- **Output**: Single `islands.js` file in `public/js/client/`
- **Tree Shaking**: Unused code is automatically removed

### TypeScript Configuration

`client/tsconfig.json` is separate from the root config:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    ...
  }
}
```

**No `any` types allowed** - use proper type definitions.

### Build Commands

| Command | Purpose |
|---------|---------|
| `npm run build:client` | One-time production build |
| `npm run dev:client` | Watch mode (rebuilds on file changes) |
| `npm run build` | Build client + update service worker cache version |

---

## Testing

### Unit Testing (Vitest)

Component unit tests are located in the same directory as the component files.

**Example**: `client/src/islands/GoalModal.test.tsx`

```tsx
import { render } from '@testing-library/preact';
import { GoalModal } from './GoalModal';

test('GoalModal renders with initial state', () => {
  const { getByText } = render(<GoalModal />);
  expect(getByText(/Goal/)).toBeTruthy();
});
```

### UI Testing (Playwright)

End-to-end tests verify island hydration in a real browser.

**Example**: `tests/ui/goals.spec.js`

```javascript
import { test, expect } from '@playwright/test';

test('GoalModal island hydrates and responds to clicks', async ({ page }) => {
  await page.goto('/');
  
  // Verify hydration and island interaction
  const goalCard = page.locator('.goal-card').first();
  await expect(goalCard).toBeVisible();
  
  // Test interactivity
  await goalCard.click();
  await expect(page.locator('.modal')).toBeVisible();
});
```

**Run tests**:
```bash
npm run test:ui
```

### Visual Testing

For canvas-based components (e.g., the future Map island using Konva), use Playwright's screenshot comparison:

```javascript
test('Map island renders correctly', async ({ page }) => {
  await page.goto('/map');
  await expect(page.locator('[data-island="MapView"]')).toHaveScreenshot();
});
```

---

## Best Practices

### Component Design

1. **Keep islands focused**: Each island should have a single responsibility
2. **Use TypeScript**: Define prop interfaces, no `any` types
3. **Avoid inline styles**: Use CSS classes (legacy CSS in `public/css/` or component-scoped CSS)
4. **Signals over props**: For dynamic data, prefer Signals over prop drilling

### Performance

1. **Lazy loading**: Islands only load when their mount point exists
2. **Code splitting**: Vite automatically splits large components
3. **Minimize bundle size**: Preact + Signals is tiny (~4KB), keep it that way

### Migration from Vanilla JS

When migrating existing vanilla JS (e.g., `public/js/goals.js`):

1. **Don't delete the old file** until the island is production-ready
2. **Test thoroughly**: Ensure feature parity
3. **Update mount points**: Change `<div id="goals">` to `<div data-island="GoalsList">`
4. **Incremental approach**: Migrate one feature at a time

---

## Troubleshooting

### Island Not Rendering

**Check**:
1. Is the island registered in `client/src/index.tsx`?
2. Does the HTML have `<div data-island="Name">` with the correct name?
3. Is `islands.js` loaded with `<script type="module" src="/js/client/islands.js"></script>`?
4. Check browser console for errors

### TypeScript Errors

**Issue**: `Cannot find module 'preact'`

**Fix**: Run `npm install` to ensure dependencies are installed.

**Issue**: `JSX element type does not have any construct or call signatures`

**Fix**: Verify `jsxImportSource: "preact"` is set in `client/tsconfig.json`.

### Build Failures

**Issue**: Vite fails to build

**Fix**: 
```bash
cd client
rm -rf node_modules
cd ..
npm install
npm run build:client
```

### State Not Updating

**Issue**: Signal changes don't trigger re-renders

**Fix**: Ensure you're mutating the `.value` property, not reassigning the signal itself:

```tsx
// ✅ Correct
count.value = count.value + 1;

// ❌ Wrong
count = signal(count.value + 1);
```

---

## Examples

### Interactive Modal

```tsx
import { useSignal } from '@preact/signals';

export function GoalModal() {
  const isOpen = useSignal(false);

  return (
    <>
      <button onClick={() => isOpen.value = true}>
        View Goal Details
      </button>
      
      {isOpen.value && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Goal Details</h2>
            <p>Distance: 150 km</p>
            <button onClick={() => isOpen.value = false}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
```

### Fetching Data

```tsx
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

export function GoalsList() {
  const goals = useSignal<Goal[]>([]);
  const loading = useSignal(true);

  useEffect(() => {
    fetch('/api/goals')
      .then(res => res.json())
      .then(data => {
        goals.value = data;
        loading.value = false;
      });
  }, []);

  if (loading.value) return <p>Loading...</p>;

  return (
    <ul>
      {goals.value.map(goal => (
        <li key={goal.id}>{goal.name}</li>
      ))}
    </ul>
  );
}
```

---

## Global Preferences Bridge

User preferences are shared between legacy vanilla JS and Preact islands through `window.userPreferences`.

### Reading Preferences

```javascript
// In legacy JS
const showUnlocked = window.userPreferences?.showFutureGoalsUnlocked ?? true;
```

```typescript
// In Preact islands (via mapStore signal)
import { showFutureGoalsUnlocked } from '../stores/mapStore';
const isUnlocked = showFutureGoalsUnlocked.value;
```

### Listening for Changes

When the user changes a preference in the Profile modal, a `preferenceChanged` custom event is dispatched:

```javascript
window.addEventListener('preferenceChanged', (e) => {
  const { showFutureGoalsUnlocked } = e.detail;
  // Re-render goals, update map markers, etc.
});
```

### Updating Preferences

Preferences are saved immediately via `PUT /api/user/preferences`. The profile modal handles this automatically.

---

## Resources

- [Preact Documentation](https://preactjs.com/)
- [Preact Signals Guide](https://preactjs.com/guide/v10/signals/)
- [Vite Documentation](https://vitejs.dev/)
- [Project Architecture Doc](./architecture.md)

---

## Questions?

For architecture questions or when implementing complex features (like the Map), refer to `docs/architecture.md` or consult the team.
