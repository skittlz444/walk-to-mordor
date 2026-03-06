import { render, h } from 'preact';
import { DistanceModal } from './islands/DistanceModal';
import { AuthForms } from './islands/AuthForms';
import { DrawerIsland } from './islands/DrawerIsland';
import { GoalModal } from './islands/GoalModal';
import { MapIsland } from './islands/MapIsland';
import { NextGoalCard } from './islands/NextGoalCard';
import { UpcomingGoalCard } from './islands/UpcomingGoalCard';
import { PartySelector } from './islands/PartySelector';
import { PartyListIsland } from './islands/PartyListIsland';
import { PartyDetailIsland } from './islands/PartyDetailIsland';
import { PartyManageIsland } from './islands/PartyManageIsland';
import { PartyJoinIsland } from './islands/PartyJoinIsland';
import { AdminDashboardIsland } from './islands/AdminDashboardIsland';
import { AdminGoalsListIsland } from './islands/AdminGoalsListIsland';
import * as partyStore from './stores/partyStore';

// Auto-hydrated islands - these are rendered from data-island attributes
const autoHydratedIslands = {
  AdminDashboardIsland,
  AdminGoalsListIsland,
  AuthForms,
  DrawerIsland,
  MapIsland,
  PartyListIsland,
  PartyDetailIsland,
  PartyManageIsland,
  PartyJoinIsland,
};

// All islands including those rendered programmatically
const allIslands = {
  AdminDashboardIsland,
  AdminGoalsListIsland,
  AuthForms,
  DistanceModal,
  DrawerIsland,
  GoalModal,
  MapIsland,
  NextGoalCard,
  PartyDetailIsland,
  PartyJoinIsland,
  PartyListIsland,
  PartyManageIsland,
  PartySelector,
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
    partyStore: typeof partyStore;
  }
}

// @ts-expect-error - Window augmentation type mismatch: TypeScript requires full Preact export but we only expose render/h for vanilla JS bridge
window.preact = { render, h };
window.preactIslands = allIslands;
window.partyStore = partyStore;

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

    // Render the island component into the target element
    render(h(IslandComponent, null), element);

    console.log(`✅ Hydrated island: ${islandName}`);
  });
}

// Initialize islands when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hydrateIslands);
} else {
  hydrateIslands();
}
