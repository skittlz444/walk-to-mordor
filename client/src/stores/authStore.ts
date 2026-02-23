/**
 * Auth State Management Store
 *
 * Centralized auth, session, and user preferences management.
 * Replaces public/js/main.js with reactive Preact Signals.
 */

import { signal, effect } from '@preact/signals';

// ============================================================================
// Types
// ============================================================================

export interface UserPreferences {
  showFutureGoalsUnlocked: boolean;
  defaultViewMap: boolean;
}

// ============================================================================
// Signals
// ============================================================================

export const isAuthenticated = signal<boolean>(false);
export const userPreferences = signal<UserPreferences>({
  showFutureGoalsUnlocked: true,
  defaultViewMap: false,
});

// ============================================================================
// Auth Utilities
// ============================================================================

export function getSessionToken(): string | null {
  return localStorage.getItem('sessionToken');
}

export function getAuthHeaders(): Record<string, string> {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function clearSession(): void {
  localStorage.removeItem('sessionToken');
}

// ============================================================================
// Auth Actions
// ============================================================================

export async function checkAuth(): Promise<boolean> {
  const token = getSessionToken();
  if (!token) {
    window.location.href = '/login';
    return false;
  }

  try {
    const response = await fetch('/api/session', {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      clearSession();
      window.location.href = '/login';
      return false;
    }

    isAuthenticated.value = true;
    return true;
  } catch (error) {
    console.error('Auth check error:', error);
    window.location.href = '/login';
    return false;
  }
}

export async function logout(): Promise<void> {
  const token = getSessionToken();
  if (token) {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: token }),
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  clearSession();
  try {
    localStorage.removeItem('defaultViewMap');
  } catch {
    /* ignore */
  }
  window.location.href = '/login';
}

// ============================================================================
// Preferences
// ============================================================================

export async function loadPreferences(): Promise<void> {
  try {
    const response = await fetch('/api/session', {
      headers: getAuthHeaders(),
    });
    if (response.ok) {
      const sessionData = await response.json();
      const prefs = { ...userPreferences.value };
      if (typeof sessionData.showFutureGoalsUnlocked === 'boolean') {
        prefs.showFutureGoalsUnlocked = sessionData.showFutureGoalsUnlocked;
      }
      if (typeof sessionData.defaultViewMap === 'boolean') {
        prefs.defaultViewMap = sessionData.defaultViewMap;
        try {
          localStorage.setItem(
            'defaultViewMap',
            sessionData.defaultViewMap ? 'true' : 'false',
          );
        } catch {
          /* localStorage may be unavailable */
        }
      }
      userPreferences.value = prefs;
    }
  } catch (prefError) {
    console.warn('Could not load user preferences:', prefError);
  }
}

// ============================================================================
// App Initialization
// ============================================================================

export async function initializeApp(): Promise<void> {
  const authenticated = await checkAuth();
  if (!authenticated) return;

  document.body.classList.add('authenticated');

  await loadPreferences();

  // Trigger calendar initialization chain
  if (typeof window.updateCalendarAndTotal === 'function') {
    window.updateCalendarAndTotal();
  }
}

// ============================================================================
// Synchronous global setup (executed on module import)
// ============================================================================

window.getAuthHeaders = getAuthHeaders;
window.logout = logout;
window.userPreferences = window.userPreferences || {
  showFutureGoalsUnlocked: true,
  defaultViewMap: false,
};

// Keep window.userPreferences in sync with the signal
effect(() => {
  const prefs = userPreferences.value;
  window.userPreferences = { ...prefs };
});
