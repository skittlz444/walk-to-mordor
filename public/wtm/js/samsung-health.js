// Samsung Health integration JavaScript
console.log('Samsung Health module loaded');

let samsungHealthStatus = {
  isLinked: false,
  linkedAt: null
};

// Initialize Samsung Health integration
document.addEventListener('DOMContentLoaded', function() {
  checkSamsungHealthStatus();
  updateSamsungHealthUI();
});

// Check if Samsung Health is linked
async function checkSamsungHealthStatus() {
  try {
    const response = await fetch('/wtm/api/samsung-health/status');
    if (response.ok) {
      samsungHealthStatus = await response.json();
      updateSamsungHealthUI();
    }
  } catch (error) {
    console.error('Failed to check Samsung Health status:', error);
  }
}

// Update UI based on Samsung Health link status
function updateSamsungHealthUI() {
  const linkButton = document.querySelector('button[onclick="handleSamsungHealthLink()"]');
  if (linkButton) {
    if (samsungHealthStatus.isLinked) {
      linkButton.innerHTML = '<i class="fas fa-unlink"></i>Unlink Samsung Health';
      linkButton.onclick = handleSamsungHealthUnlink;
    } else {
      linkButton.innerHTML = '<i class="fas fa-link"></i>Link Samsung Health';
      linkButton.onclick = handleSamsungHealthLink;
    }
  }
}

// Handle linking Samsung Health account
async function handleSamsungHealthLink() {
  try {
    // Get authorization URL
    const response = await fetch('/wtm/api/samsung-health/auth-url');
    if (!response.ok) {
      throw new Error('Failed to get authorization URL');
    }
    
    const data = await response.json();
    
    // Show linking modal
    showSamsungHealthLinkModal(data.authUrl, data.state);
    
  } catch (error) {
    console.error('Error linking Samsung Health:', error);
    alert('Failed to start Samsung Health linking process. Please try again.');
  }
}

// Handle unlinking Samsung Health account
async function handleSamsungHealthUnlink() {
  if (!confirm('Are you sure you want to unlink your Samsung Health account?')) {
    return;
  }

  try {
    const response = await fetch('/wtm/api/samsung-health/unlink', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      samsungHealthStatus.isLinked = false;
      samsungHealthStatus.linkedAt = null;
      updateSamsungHealthUI();
      alert('Samsung Health account unlinked successfully');
    } else {
      throw new Error('Failed to unlink Samsung Health account');
    }
  } catch (error) {
    console.error('Error unlinking Samsung Health:', error);
    alert('Failed to unlink Samsung Health account. Please try again.');
  }
}

// Show Samsung Health linking modal
function showSamsungHealthLinkModal(authUrl, state) {
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Link Samsung Health Account</h3>
          <button type="button" class="close-btn" onclick="closeSamsungHealthModal()">&times;</button>
        </div>
        <div class="modal-body">
          <p>To sync your walking data from Samsung Health, you'll need to authorize access to your account.</p>
          <div class="samsung-health-auth-info">
            <h4>What data will be accessed?</h4>
            <ul>
              <li><i class="fas fa-walking"></i> Daily walking distance/steps</li>
              <li><i class="fas fa-calendar"></i> Activity dates</li>
            </ul>
            <p><small><i class="fas fa-lock"></i> Your data is encrypted and only used to sync walking distances. We cannot access other health information.</small></p>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="closeSamsungHealthModal()">Cancel</button>
          <button type="button" class="btn btn-primary" onclick="proceedToSamsungHealthAuth('${authUrl}', '${state}')">
            <i class="fas fa-external-link-alt"></i>
            Continue to Samsung Health
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);
  
  // Store state for callback verification
  sessionStorage.setItem('samsung_health_auth_state', state);
}

// Close Samsung Health modal
function closeSamsungHealthModal() {
  const modal = document.querySelector('.modal-overlay');
  if (modal) {
    modal.remove();
  }
}

// Proceed to Samsung Health authorization
function proceedToSamsungHealthAuth(authUrl, state) {
  // In a real implementation, this would open Samsung Health authorization
  // For this demo, we'll simulate a successful authorization
  closeSamsungHealthModal();
  
  // Simulate successful authorization after a delay
  showSamsungHealthAuthSimulation(state);
}

// Simulate Samsung Health authorization for demo purposes
function showSamsungHealthAuthSimulation(state) {
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Samsung Health Authorization</h3>
        </div>
        <div class="modal-body">
          <div class="auth-simulation">
            <p><strong>This is a demo simulation of Samsung Health authorization.</strong></p>
            <p>In a real implementation, you would be redirected to Samsung's authorization page.</p>
            <div class="demo-buttons">
              <button type="button" class="btn btn-success" onclick="simulateAuthSuccess('${state}')">
                <i class="fas fa-check"></i>
                Simulate Authorization Success
              </button>
              <button type="button" class="btn btn-danger" onclick="simulateAuthFailure()">
                <i class="fas fa-times"></i>
                Simulate Authorization Failure
              </button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="closeSamsungHealthModal()">Cancel</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);
}

// Simulate successful authorization
async function simulateAuthSuccess(state) {
  try {
    closeSamsungHealthModal();
    
    // Send mock auth code to backend
    const response = await fetch('/wtm/api/samsung-health/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        authCode: 'mock_auth_code',
        state: state
      })
    });

    if (response.ok) {
      samsungHealthStatus.isLinked = true;
      samsungHealthStatus.linkedAt = new Date().toISOString();
      updateSamsungHealthUI();
      alert('Samsung Health account linked successfully!');
    } else {
      throw new Error('Failed to complete authorization');
    }
  } catch (error) {
    console.error('Error completing Samsung Health authorization:', error);
    alert('Failed to complete Samsung Health authorization. Please try again.');
  }
}

// Simulate failed authorization
function simulateAuthFailure() {
  closeSamsungHealthModal();
  alert('Samsung Health authorization was cancelled or failed.');
}

// Sync distance from Samsung Health for a specific date
async function syncFromSamsungHealth(date) {
  if (!samsungHealthStatus.isLinked) {
    alert('Samsung Health account not linked. Please link your account first.');
    return null;
  }

  try {
    // Show loading state
    const syncButton = document.getElementById('samsung-health-sync-btn');
    if (syncButton) {
      syncButton.disabled = true;
      syncButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
    }

    const response = await fetch('/wtm/api/samsung-health/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        date: date
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.distance;
    } else {
      const error = await response.json();
      throw new Error(error.error || 'Failed to sync from Samsung Health');
    }
  } catch (error) {
    console.error('Error syncing from Samsung Health:', error);
    alert('Failed to sync data from Samsung Health: ' + error.message);
    return null;
  } finally {
    // Reset loading state
    const syncButton = document.getElementById('samsung-health-sync-btn');
    if (syncButton) {
      syncButton.disabled = false;
      syncButton.innerHTML = '<i class="fas fa-sync"></i> Sync from Samsung Health';
    }
  }
}

// Add Samsung Health sync button to distance modal
function addSamsungHealthSyncButton(modalElement, selectedDate) {
  if (!samsungHealthStatus.isLinked) {
    return; // Don't show sync button if not linked
  }

  const modalBody = modalElement.querySelector('.modal-body');
  if (modalBody) {
    // Add sync button after distance input
    const distanceGroup = modalBody.querySelector('.form-group:last-child');
    if (distanceGroup) {
      const syncGroup = document.createElement('div');
      syncGroup.className = 'form-group samsung-health-sync-group';
      syncGroup.innerHTML = `
        <button type="button" id="samsung-health-sync-btn" class="btn btn-outline-primary btn-sm" onclick="handleSamsungHealthSync('${selectedDate}')">
          <i class="fas fa-sync"></i>
          Sync from Samsung Health
        </button>
        <div id="samsung-health-sync-status" class="sync-status" style="display: none;">
          <small class="text-muted">
            <i class="fas fa-check-circle text-success"></i>
            Synced from Samsung Health
          </small>
        </div>
      `;
      
      distanceGroup.insertAdjacentElement('afterend', syncGroup);
    }
  }
}

// Handle Samsung Health sync button click
async function handleSamsungHealthSync(selectedDate) {
  const distance = await syncFromSamsungHealth(selectedDate);
  
  if (distance !== null) {
    // Fill distance input with synced value
    const distanceInput = document.getElementById('distance-input');
    if (distanceInput) {
      distanceInput.value = distance.toFixed(2);
      
      // Show sync status
      const syncStatus = document.getElementById('samsung-health-sync-status');
      if (syncStatus) {
        syncStatus.style.display = 'block';
      }
      
      // Mark as synced from Samsung Health (will be saved when user clicks Save)
      distanceInput.dataset.syncSource = 'samsung_health';
    }
  }
}

// Make functions available globally
window.handleSamsungHealthLink = handleSamsungHealthLink;
window.handleSamsungHealthUnlink = handleSamsungHealthUnlink;
window.closeSamsungHealthModal = closeSamsungHealthModal;
window.proceedToSamsungHealthAuth = proceedToSamsungHealthAuth;
window.simulateAuthSuccess = simulateAuthSuccess;
window.simulateAuthFailure = simulateAuthFailure;
window.syncFromSamsungHealth = syncFromSamsungHealth;
window.addSamsungHealthSyncButton = addSamsungHealthSyncButton;
window.handleSamsungHealthSync = handleSamsungHealthSync;
window.samsungHealthStatus = samsungHealthStatus;