// Authentication and Samsung Health integration
console.log('Auth.js script loaded');

let currentUser = null;

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
  } catch (error) {
    console.error('Error initializing auth:', error);
    showLoginSection();
  }
}

function setupAuthEventListeners() {
  // Login form submission
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  // Register form submission
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
  
  // Show register form link
  const showRegisterLink = document.getElementById('show-register-link');
  if (showRegisterLink) {
    showRegisterLink.addEventListener('click', function(e) {
      e.preventDefault();
      showRegisterForm();
    });
  }
  
  // Show login form link
  const showLoginLink = document.getElementById('show-login-link');
  if (showLoginLink) {
    showLoginLink.addEventListener('click', function(e) {
      e.preventDefault();
      showLoginForm();
    });
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

async function handleLogin(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const username = formData.get('username');
  const password = formData.get('password');
  const errorDiv = document.getElementById('login-error');
  
  // Clear previous errors
  if (errorDiv) {
    errorDiv.textContent = '';
    errorDiv.style.display = 'none';
  }
  
  try {
    const response = await fetch('/wtm/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      currentUser = result.user;
      showUserSection();
      updateSamsungHealthStatus();
      
      // Refresh the calendar and totals to show user-specific data
      if (typeof updateCalendarAndTotal === 'function') {
        updateCalendarAndTotal();
      }
    } else {
      if (errorDiv) {
        errorDiv.textContent = result.error || 'Login failed';
        errorDiv.style.display = 'block';
      }
    }
  } catch (error) {
    console.error('Login error:', error);
    if (errorDiv) {
      errorDiv.textContent = 'Login failed. Please try again.';
      errorDiv.style.display = 'block';
    }
  }
}

async function handleRegister(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const username = formData.get('username');
  const email = formData.get('email');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirm-password');
  const errorDiv = document.getElementById('register-error');
  
  // Clear previous errors
  if (errorDiv) {
    errorDiv.textContent = '';
    errorDiv.style.display = 'none';
  }
  
  // Client-side validation
  if (password !== confirmPassword) {
    if (errorDiv) {
      errorDiv.textContent = 'Passwords do not match';
      errorDiv.style.display = 'block';
    }
    return;
  }
  
  try {
    const response = await fetch('/wtm/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, email, password })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      currentUser = result.user;
      showUserSection();
      updateSamsungHealthStatus();
      
      // Refresh the calendar and totals to show user-specific data
      if (typeof updateCalendarAndTotal === 'function') {
        updateCalendarAndTotal();
      }
    } else {
      if (errorDiv) {
        if (result.errors && result.errors.length > 0) {
          errorDiv.innerHTML = result.errors.join('<br>');
        } else {
          errorDiv.textContent = result.error || 'Registration failed';
        }
        errorDiv.style.display = 'block';
      }
    }
  } catch (error) {
    console.error('Registration error:', error);
    if (errorDiv) {
      errorDiv.textContent = 'Registration failed. Please try again.';
      errorDiv.style.display = 'block';
    }
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
  
  // Show login form by default
  showLoginForm();
}

function showUserSection() {
  const loginSection = document.getElementById('login-section');
  const userSection = document.getElementById('user-section');
  const userDisplay = document.getElementById('user-display');
  
  if (loginSection && userSection) {
    loginSection.style.display = 'none';
    userSection.style.display = 'block';
  }
  
  if (userDisplay && currentUser) {
    userDisplay.textContent = currentUser.username;
  }
}

function showLoginForm() {
  const loginForm = document.getElementById('login-form-container');
  const registerForm = document.getElementById('register-form-container');
  
  if (loginForm && registerForm) {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  }
}

function showRegisterForm() {
  const loginForm = document.getElementById('login-form-container');
  const registerForm = document.getElementById('register-form-container');
  
  if (loginForm && registerForm) {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
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