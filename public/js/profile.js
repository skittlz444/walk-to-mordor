// User profile modal functionality

/**
 * Show user profile modal
 */
async function showProfileModal() {
  // Fetch current user info
  let currentUsername = '';
  let currentEmail = '';
  let showFutureGoalsUnlocked = true;
  let defaultViewMap = false;
  
  try {
    const response = await fetch('/api/session', {
      headers: window.getAuthHeaders()
    });
    
    if (response.ok) {
      const data = await response.json();
      currentUsername = data.username || '';
      currentEmail = data.email || '';
      showFutureGoalsUnlocked = typeof data.showFutureGoalsUnlocked === 'boolean' ? data.showFutureGoalsUnlocked : true;
      defaultViewMap = typeof data.defaultViewMap === 'boolean' ? data.defaultViewMap : false;
    }
  } catch (error) {
    console.error('Error fetching user info:', error);
  }

  // Helper function to escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">User Profile</h2>
          <button class="close-btn" id="close-profile-modal" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="profile-username">Username:</label>
            <input type="text" id="profile-username" value="${escapeHtml(currentUsername)}" placeholder="Enter username" />
            <small class="field-hint">3-30 characters, letters, numbers, and underscores only</small>
          </div>
          <div class="form-group">
            <label for="profile-email">Email:</label>
            <input type="email" id="profile-email" value="${escapeHtml(currentEmail)}" placeholder="Enter email" />
            <small class="field-hint">Valid email address</small>
          </div>
          <div class="form-group toggle-group">
            <label for="preview-milestones-toggle" class="toggle-label">
              Preview all milestones
              <small class="field-hint">Reveal future destinations on your journey</small>
            </label>
            <label class="toggle-switch">
              <input type="checkbox" id="preview-milestones-toggle" ${showFutureGoalsUnlocked ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="form-group toggle-group">
            <label for="default-view-toggle" class="toggle-label">
              Default to map view
              <small class="field-hint">Open the map instead of the journey page on launch</small>
            </label>
            <label class="toggle-switch">
              <input type="checkbox" id="default-view-toggle" ${defaultViewMap ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div id="preference-status" class="preference-status"></div>
          <div id="profile-error" class="error-message"></div>
          <div id="profile-success" class="success-message"></div>
        </div>
        <div class="modal-footer modal-footer-full">
          <div class="modal-footer-btns modal-footer-btns-profile">
            <button type="button" class="btn btn-primary" id="save-profile-btn">Save Changes</button>
            <button type="button" class="btn btn-danger" id="logout-modal-btn">Logout</button>
            <button type="button" class="btn btn-secondary" id="cancel-profile-btn">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  // Add event listeners
  document.getElementById('save-profile-btn').addEventListener('click', handleSaveProfile);
  document.getElementById('logout-modal-btn').addEventListener('click', handleLogoutFromModal);
  document.getElementById('cancel-profile-btn').addEventListener('click', closeProfileModal);
  document.getElementById('close-profile-modal').addEventListener('click', closeProfileModal);

  /**
   * Save a single preference toggle via the API.
   * Handles status display, error rollback, and event dispatch.
   */
  async function savePreference(toggle, preferenceKey, newValue) {
    const statusDiv = document.getElementById('preference-status');
    statusDiv.textContent = 'Saving...';
    statusDiv.className = 'preference-status saving';

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...window.getAuthHeaders()
        },
        body: JSON.stringify({ [preferenceKey]: newValue })
      });

      if (response.ok) {
        statusDiv.textContent = 'Saved';
        statusDiv.className = 'preference-status saved';
        setTimeout(() => { statusDiv.textContent = ''; statusDiv.className = 'preference-status'; }, 1500);

        // Update global state
        if (window.userPreferences) {
          window.userPreferences[preferenceKey] = newValue;
        }

        // Persist defaultViewMap to localStorage for fast redirect
        if (preferenceKey === 'defaultViewMap') {
          try {
            localStorage.setItem('defaultViewMap', newValue ? 'true' : 'false');
          } catch (e) { /* localStorage may be unavailable */ }
        }

        window.dispatchEvent(new CustomEvent('preferenceChanged', {
          detail: { [preferenceKey]: newValue }
        }));
      } else {
        const data = await response.json();
        statusDiv.textContent = data.error || 'Failed to save';
        statusDiv.className = 'preference-status error';
        toggle.checked = !newValue; // Revert toggle
      }
    } catch (error) {
      console.error('Error saving preference:', error);
      statusDiv.textContent = 'Network error';
      statusDiv.className = 'preference-status error';
      toggle.checked = !newValue; // Revert toggle
    }
  }

  // Toggle preference listener
  document.getElementById('preview-milestones-toggle').addEventListener('change', function(e) {
    savePreference(e.target, 'showFutureGoalsUnlocked', e.target.checked);
  });

  // Default view toggle listener
  document.getElementById('default-view-toggle').addEventListener('change', function(e) {
    savePreference(e.target, 'defaultViewMap', e.target.checked);
  });

  // Close modal when clicking overlay
  modalOverlay.addEventListener('click', function(e) {
    if (e.target === modalOverlay) {
      closeProfileModal();
    }
  });

  // Close modal on Escape key
  function escKeyHandler(e) {
    if (e.key === 'Escape') {
      closeProfileModal();
    }
  }
  document.addEventListener('keydown', escKeyHandler);

  // Focus on username input
  setTimeout(() => {
    document.getElementById('profile-username').focus();
  }, 100);

  function closeProfileModal() {
    document.removeEventListener('keydown', escKeyHandler);
    modalOverlay.remove();
  }
}

/**
 * Handle save profile
 */
async function handleSaveProfile() {
  const username = document.getElementById('profile-username').value.trim();
  const email = document.getElementById('profile-email').value.trim();
  const errorDiv = document.getElementById('profile-error');
  const successDiv = document.getElementById('profile-success');
  
  // Clear previous messages
  errorDiv.textContent = '';
  successDiv.textContent = '';

  // Validate input
  if (!username && !email) {
    errorDiv.textContent = 'Please provide at least one field to update';
    return;
  }

  // Build request body with only provided fields
  const updates = {};
  if (username) updates.username = username;
  if (email) updates.email = email;

  try {
    const response = await fetch('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...window.getAuthHeaders()
      },
      body: JSON.stringify(updates)
    });

    const data = await response.json();

    if (response.ok) {
      successDiv.textContent = data.message || 'Profile updated successfully!';
      
      // Close modal after a short delay
      setTimeout(() => {
        document.querySelector('.modal-overlay')?.remove();
      }, 1500);
    } else {
      errorDiv.textContent = data.error || 'Failed to update profile';
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    errorDiv.textContent = 'Network error. Please try again.';
  }
}

/**
 * Handle logout from modal
 */
async function handleLogoutFromModal() {
  // Close the modal first
  const modalOverlay = document.querySelector('.modal-overlay');
  if (modalOverlay) {
    modalOverlay.remove();
  }
  
  // Call the global logout function
  if (window.logout) {
    window.logout();
  }
}

// Export functions for use by other modules
window.profileModule = {
  showProfileModal,
  handleSaveProfile,
  handleLogoutFromModal
};

// Make function available globally
window.showProfileModal = showProfileModal;
