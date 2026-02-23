/**
 * AppBootstrapIsland
 *
 * Replaces the DOMContentLoaded listener in public/js/main.js.
 * Orchestrates auth check, preference loading, and app init on mount.
 * Renders nothing — exists solely for its side-effect.
 */

import { useEffect } from 'preact/hooks';
import { initializeApp } from '../stores/authStore';

export function AppBootstrapIsland() {
  useEffect(() => {
    initializeApp();
  }, []);

  return null;
}
