import { render, h } from 'preact';
import { HelloWorld } from './islands/HelloWorld';
import { AuthForms } from './islands/AuthForms';
import { GoalModal } from './islands/GoalModal';

// Island registry - maps island names to their components
const islands = {
  HelloWorld,
  AuthForms,
  GoalModal,
};

// Type for island names
type IslandName = keyof typeof islands;

// Expose Preact and islands to global scope for vanilla JS integration
declare global {
  interface Window {
    preact: {
      render: typeof render;
      h: typeof h;
    };
    preactIslands: typeof islands;
  }
}

window.preact = { render, h };
window.preactIslands = islands;

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

    const IslandComponent = islands[islandName];
    
    if (!IslandComponent) {
      console.error(`Island component "${islandName}" not found in registry`);
      return;
    }

    // Render the island component into the target element
    render(<IslandComponent />, element);
    
    console.log(`✅ Hydrated island: ${islandName}`);
  });
}

// Initialize islands when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hydrateIslands);
} else {
  hydrateIslands();
}
