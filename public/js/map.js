// Map page utilities - drawer toggle and navigation

/**
 * Opens the side drawer navigation
 */
function openDrawer() {
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawer-overlay');
  
  if (drawer && overlay) {
    drawer.classList.add('active');
    overlay.classList.add('active');
  }
}

/**
 * Closes the side drawer navigation
 */
function closeDrawer() {
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawer-overlay');
  
  if (drawer && overlay) {
    drawer.classList.remove('active');
    overlay.classList.remove('active');
  }
}

/**
 * Check authentication on page load
 * Reuses the checkAuth function from main.js
 */
async function checkMapAuth() {
  const token = localStorage.getItem('sessionToken');
  if (!token) {
    window.location.href = '/login';
    return false;
  }
  
  try {
    const response = await fetch('/api/session', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      localStorage.removeItem('sessionToken');
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

// Run auth check on page load
checkMapAuth();

// Close drawer on Escape key
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeDrawer();
  }
});
