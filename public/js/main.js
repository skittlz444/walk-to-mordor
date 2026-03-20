// Main application controller - coordinates domain modules

// Authentication utilities
function getSessionToken() {
  return localStorage.getItem('sessionToken');
}

function getAuthHeaders() {
  const token = getSessionToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function clearSession() {
  localStorage.removeItem('sessionToken');
}

// Check if user is authenticated
async function checkAuth() {
  const token = getSessionToken();
  if (!token) {
    // No token, redirect to login
    window.location.href = '/login';
    return false;
  }

  try {
    const response = await fetch('/api/session', {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      // Session invalid or expired
      clearSession();
      window.location.href = '/login';
      return false;
    }

    return true;
  } catch (error) {
    console.error('Auth check error:', error);
    window.location.href = '/login';
    return false;
  }
}

// Logout function
async function logout() {
  const token = getSessionToken();
  if (token) {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId: token })
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  clearSession();
  try { localStorage.removeItem('defaultViewMap'); } catch (e) { /* ignore */ }
  window.location.href = '/login';
}

// Make auth utilities available globally
window.getAuthHeaders = getAuthHeaders;
window.logout = logout;

// Initialize global user preferences (default: locked, journey view)
window.userPreferences = window.userPreferences || {
  showFutureGoalsUnlocked: false,
  defaultViewMap: false
};

document.addEventListener("DOMContentLoaded", async function () {
  // Check authentication before initializing app
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) {
    return; // Redirect will happen in checkAuth
  }

  // Reveal page after auth succeeds (lifts CSS auth-wall on map page)
  document.body.classList.add('authenticated');

  // Load user preferences from session
  try {
    const sessionResponse = await fetch('/api/session', {
      headers: getAuthHeaders()
    });
    if (sessionResponse.ok) {
      const sessionData = await sessionResponse.json();
      if (typeof sessionData.showFutureGoalsUnlocked === 'boolean') {
        window.userPreferences.showFutureGoalsUnlocked = sessionData.showFutureGoalsUnlocked;
      }
      if (typeof sessionData.defaultViewMap === 'boolean') {
        window.userPreferences.defaultViewMap = sessionData.defaultViewMap;
        try {
          localStorage.setItem('defaultViewMap', sessionData.defaultViewMap ? 'true' : 'false');
        } catch (e) { /* localStorage may be unavailable */ }
      }
    }
  } catch (prefError) {
    console.warn('Could not load user preferences:', prefError);
  }

  // Initialize application
  async function initializeApp() {
    try {
      // Initialize calendar module if available
      if (window.calendarModule && window.calendarModule.createCalendarGrid) {
        window.calendarModule.createCalendarGrid();

        // Make updateCalendarAndTotal available globally after calendar is initialized
        if (window.calendarModule.updateCalendarAndTotal) {
          window.updateCalendarAndTotal = window.calendarModule.updateCalendarAndTotal;

          // Load calendar progress and total distance on initialization
          window.updateCalendarAndTotal();
        }
      }

      // Initialize progress module functions globally
      if (window.progressModule) {
        // Make progress modal function available for calendar clicks
        window.showProgressModal = window.progressModule.showDistanceModal;
      }

      // Goals and total distance will be initialized by updateCalendarAndTotal -> fetchAndUpdateTotalDistance
      if (window.goalsModule && window.goalsModule.renderGoals) {
        // Module available for initialization via calendar data loading
      }
    } catch (error) {
      console.error("Application initialization error:", error);
    }
  }

  // Start the app
  initializeApp();
});
