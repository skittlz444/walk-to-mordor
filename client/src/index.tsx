import { render, h } from 'preact';
// Auth store — imported first so window.getAuthHeaders / window.logout / window.userPreferences
// are available synchronously before any island mounts.
import './stores/authStore';
import { AppBootstrapIsland } from './islands/AppBootstrapIsland';
import { DistanceModal } from './islands/DistanceModal';
import { DistanceModalIsland } from './islands/DistanceModalIsland';
import { AuthForms } from './islands/AuthForms';
import { CalendarIsland } from './islands/CalendarIsland';
import { CalendarSheetIsland } from './islands/CalendarSheetIsland';
import { DrawerIsland } from './islands/DrawerIsland';
import { GoalModal } from './islands/GoalModal';
import { GoalsSectionIsland } from './islands/GoalsSectionIsland';
import { MapIsland } from './islands/MapIsland';
import { NextGoalCard } from './islands/NextGoalCard';
import { PasswordResetIsland } from './islands/PasswordResetIsland';
import { ProfileModalIsland } from './islands/ProfileModalIsland';
import { UpcomingGoalCard } from './islands/UpcomingGoalCard';

// Auto-hydrated islands - these are rendered from data-island attributes
const autoHydratedIslands = {
  AppBootstrapIsland,
  AuthForms,
  CalendarIsland,
  DistanceModalIsland,
  DrawerIsland,
  GoalsSectionIsland,
  MapIsland,
  PasswordResetIsland,
};

// All islands including those rendered programmatically
const allIslands = {
  AppBootstrapIsland,
  AuthForms,
  CalendarIsland,
  CalendarSheetIsland,
  DistanceModal,
  DistanceModalIsland,
  DrawerIsland,
  GoalModal,
  GoalsSectionIsland,
  MapIsland,
  NextGoalCard,
  PasswordResetIsland,
  ProfileModalIsland,
  UpcomingGoalCard,
};

// Type for auto-hydrated island names
type IslandName = keyof typeof autoHydratedIslands;

// Expose Preact and islands to global scope for vanilla JS integration
declare global {
  interface Window {
    preact: {
      render: typeof render;
      h: typeof h;
    };
    preactIslands: typeof allIslands;
  }
}

// @ts-expect-error - Window augmentation type mismatch: TypeScript requires full Preact export but we only expose render/h for vanilla JS bridge
window.preact = { render, h };
window.preactIslands = allIslands;

// Programmatic profile modal rendering — pre-fetch session data to match old behavior
window.showProfileModal = async function() {
  let initialData;
  try {
    const response = await fetch('/api/session', {
      headers: window.getAuthHeaders()
    });
    if (response.ok) {
      initialData = await response.json();
    }
  } catch (_e) { /* will fall back to component-level fetch */ }
  const container = document.createElement('div');
  container.id = 'profile-modal-container';
  document.body.appendChild(container);
  render(h(ProfileModalIsland, {
    onClose: () => { render(null, container); container.remove(); },
    initialData,
  }), container);
};

window.profileModule = {
  showProfileModal: () => window.showProfileModal?.(),
};

/**
 * Discovers and hydrates all Preact islands on the page.
 * Islands are identified by elements with a `data-island` attribute.
 * 
 * Example usage in HTML:
 * <div id="preact-root" data-island="AuthForms"></div>
 */
function hydrateIslands() {
  // Find all elements with data-island attribute
  const islandElements = document.querySelectorAll('[data-island]');

  islandElements.forEach((element) => {
    const islandName = element.getAttribute('data-island') as IslandName;

    if (!islandName) {
      console.warn('Island element found without island name:', element);
      return;
    }

    const IslandComponent = autoHydratedIslands[islandName];

    if (!IslandComponent) {
      console.error(`Island component "${islandName}" not found in registry`);
      return;
    }

    // Collect data-* attributes as props
    const props: Record<string, string> = {};
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith('data-') && attr.name !== 'data-island') {
        const propName = attr.name.slice(5).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
        props[propName] = attr.value;
      }
    }

    // Render the island component into the target element
    render(h(IslandComponent, Object.keys(props).length > 0 ? props : null), element);

    console.log(`✅ Hydrated island: ${islandName}`);
  });
}

// Initialize islands when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hydrateIslands);
} else {
  hydrateIslands();
}
