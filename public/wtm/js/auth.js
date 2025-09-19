// Authentication and Samsung Health integration
console.log('Auth.js script loaded');

let currentUser = null;
let googleAuth = null;

document.addEventListener('DOMContentLoaded', function() {
  console.log('Auth DOMContentLoaded fired');
  
  // Initialize authentication
  initializeAuth();
  
  // Set up event listeners
  setupAuthEventListeners();
});

async function initializeAuth() {
  try {
    // Check current authentication status
    const response = await fetch('/wtm/api/auth/status');
    const authStatus = await response.json();
    
    if (authStatus.authenticated) {
      currentUser = authStatus.user;
      showUserSection();
      updateSamsungHealthStatus();
    } else {
      showLoginSection();
    }
    
    // Initialize Google Sign-In
    initializeGoogleAuth();
  } catch (error) {
    console.error('Error initializing auth:', error);
    showLoginSection();
  }
}

function initializeGoogleAuth() {
  // Initialize Google API
  if (typeof gapi !== 'undefined') {
    gapi.load('auth2', function() {
      gapi.auth2.init({
        client_id: 'YOUR_GOOGLE_CLIENT_ID' // This would be configured via environment variables
      }).then(function() {
        googleAuth = gapi.auth2.getAuthInstance();
      });
    });
  }
}

function setupAuthEventListeners() {
  // Google login button
  const googleLoginBtn = document.getElementById('google-login-btn');
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', handleGoogleLogin);
  }
  
  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  // Profile button
  const profileBtn = document.getElementById('profile-btn');
  if (profileBtn) {
    profileBtn.addEventListener('click', showProfileModal);
  }
  
  // Profile modal close
  const profileModalClose = document.getElementById('profile-modal-close');
  if (profileModalClose) {
    profileModalClose.addEventListener('click', hideProfileModal);
  }
  
  // Samsung Health link/unlink buttons
  const linkSamsungBtn = document.getElementById('link-samsung-btn');
  if (linkSamsungBtn) {
    linkSamsungBtn.addEventListener('click', handleSamsungHealthLink);
  }
  
  const unlinkSamsungBtn = document.getElementById('unlink-samsung-btn');
  if (unlinkSamsungBtn) {
    unlinkSamsungBtn.addEventListener('click', handleSamsungHealthUnlink);
  }
  
  // Close modal when clicking outside
  const profileModal = document.getElementById('profile-modal');
  if (profileModal) {
    profileModal.addEventListener('click', function(e) {
      if (e.target === profileModal) {
        hideProfileModal();
      }
    });
  }
}

async function handleGoogleLogin() {
  try {
    // For demo purposes, we'll simulate Google OAuth
    // In a real implementation, this would use Google's OAuth 2.0 flow
    console.log('Google login clicked - would redirect to Google OAuth');
    
    // Simulate successful Google login for testing
    const mockGoogleToken = 'mock_google_token_' + Date.now();
    
    // For now, let's create a test user without actually calling Google
    const testUser = {
      email: 'test@example.com',
      name: 'Test User'
    };
    
    // Call our backend API to create/login user
    const response = await fetch('/wtm/api/auth/google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: mockGoogleToken,
        // In real implementation, this would be the Google OAuth token
        user: testUser
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      currentUser = result.user;
      showUserSection();
      updateSamsungHealthStatus();
      
      // Refresh the calendar and totals to show user-specific data
      if (typeof updateCalendarAndTotal === 'function') {
        updateCalendarAndTotal();
      }
    } else {
      const error = await response.json();
      alert('Login failed: ' + error.error);
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Login failed. Please try again.');
  }
}

async function handleLogout() {
  try {
    const response = await fetch('/wtm/api/auth/logout', {
      method: 'POST'
    });
    
    if (response.ok) {
      currentUser = null;
      showLoginSection();
      hideProfileModal();
      
      // Refresh the calendar and totals to show anonymous data
      if (typeof updateCalendarAndTotal === 'function') {
        updateCalendarAndTotal();
      }
    }
  } catch (error) {
    console.error('Logout error:', error);
  }
}

function showLoginSection() {
  const loginSection = document.getElementById('login-section');
  const userSection = document.getElementById('user-section');
  
  if (loginSection && userSection) {
    loginSection.style.display = 'block';
    userSection.style.display = 'none';
  }
}

function showUserSection() {
  const loginSection = document.getElementById('login-section');
  const userSection = document.getElementById('user-section');
  const userEmail = document.getElementById('user-email');
  
  if (loginSection && userSection) {
    loginSection.style.display = 'none';
    userSection.style.display = 'block';
  }
  
  if (userEmail && currentUser) {
    userEmail.textContent = currentUser.email;
  }
}

function showProfileModal() {
  const profileModal = document.getElementById('profile-modal');
  if (profileModal) {
    profileModal.style.display = 'flex';
  }
}

function hideProfileModal() {
  const profileModal = document.getElementById('profile-modal');
  if (profileModal) {
    profileModal.style.display = 'none';
  }
}

async function updateSamsungHealthStatus() {
  if (!currentUser) return;
  
  try {
    const response = await fetch('/wtm/api/samsung-health/status');
    const status = await response.json();
    
    const linkedSection = document.getElementById('samsung-linked');
    const notLinkedSection = document.getElementById('samsung-not-linked');
    
    if (status.linked) {
      linkedSection.style.display = 'block';
      notLinkedSection.style.display = 'none';
    } else {
      linkedSection.style.display = 'none';
      notLinkedSection.style.display = 'block';
    }
  } catch (error) {
    console.error('Error checking Samsung Health status:', error);
  }
}

async function handleSamsungHealthLink() {
  try {
    // In a real implementation, this would redirect to Samsung Health OAuth
    console.log('Samsung Health link clicked - would redirect to Samsung OAuth');
    
    // For demo purposes, simulate Samsung Health linking
    const mockAuthCode = 'mock_samsung_auth_code_' + Date.now();
    
    const response = await fetch('/wtm/api/samsung-health/link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: mockAuthCode,
        client_id: 'mock_client_id',
        client_secret: 'mock_client_secret',
        redirect_uri: window.location.origin + '/samsung-health/callback'
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      alert('Samsung Health linked successfully!');
      updateSamsungHealthStatus();
      currentUser.samsung_health_linked = true;
    } else {
      const error = await response.json();
      alert('Failed to link Samsung Health: ' + error.error);
    }
  } catch (error) {
    console.error('Samsung Health link error:', error);
    alert('Failed to link Samsung Health. Please try again.');
  }
}

async function handleSamsungHealthUnlink() {
  try {
    const response = await fetch('/wtm/api/samsung-health/unlink', {
      method: 'POST'
    });
    
    if (response.ok) {
      const result = await response.json();
      alert('Samsung Health unlinked successfully!');
      updateSamsungHealthStatus();
      currentUser.samsung_health_linked = false;
    } else {
      const error = await response.json();
      alert('Failed to unlink Samsung Health: ' + error.error);
    }
  } catch (error) {
    console.error('Samsung Health unlink error:', error);
    alert('Failed to unlink Samsung Health. Please try again.');
  }
}

// Function to sync Samsung Health data for a specific date
async function syncSamsungHealthForDate(date) {
  if (!currentUser || !currentUser.samsung_health_linked) {
    return null;
  }
  
  try {
    const response = await fetch('/wtm/api/sync/samsung-health', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ date: date })
    });
    
    if (response.ok) {
      const result = await response.json();
      return result;
    } else {
      const error = await response.json();
      console.error('Samsung Health sync error:', error);
      return null;
    }
  } catch (error) {
    console.error('Samsung Health sync error:', error);
    return null;
  }
}

// Make functions available globally
window.syncSamsungHealthForDate = syncSamsungHealthForDate;
window.currentUser = function() { return currentUser; };