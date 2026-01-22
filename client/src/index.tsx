import { render, h } from 'preact';
import { HelloWorld } from './islands/HelloWorld';
import { AuthForms } from './islands/AuthForms';
import { GoalModal } from './islands/GoalModal';

// Auto-hydrated islands - these are rendered from data-island attributes
const autoHydratedIslands = {
  HelloWorld,
  AuthForms,
};

// All islands including those rendered programmatically
const allIslands = {
  HelloWorld,
  AuthForms,
  GoalModal,
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

/**
 * Discovers and hydrates all Preact islands on the page.
 * Islands are identified by elements with a `data-island` attribute.
 * 
 * Example usage in HTML:
 * <div id="preact-root" data-island="HelloWorld"></div>
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
    // @ts-expect-error - TypeScript incorrectly infers that these islands require props, but HelloWorld/AuthForms accept none
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
