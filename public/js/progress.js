// Progress domain functions

// Progress-related state
let popupEvent;
let popupDate;
let isEdit = false;
let escKeyHandler = null; // Store ESC key handler for cleanup

/**
 * Clean up ESC key listener if present.
 * Centralized cleanup to prevent memory leaks.
 */
function cleanupEscKeyListener() {
  if (escKeyHandler) {
    document.removeEventListener('keydown', escKeyHandler);
    escKeyHandler = null;
  }
}

// Callback hooks for external integration (e.g., Map island)
// Called after successful save/update/delete operations
let onWalkSavedCallback = null;
// Called when modal is dismissed without saving
let onDismissCallback = null;

/**
 * Register a callback to be called after a walk is saved/updated/deleted.
 * @param {function} callback - Function called with {action: 'save'|'update'|'delete', date: string, distance?: number}
 */
window.onWalkSaved = function(callback) {
  onWalkSavedCallback = callback;
};

/**
 * Register a callback to be called when modal is dismissed without saving.
 * @param {function} callback - Function called with no arguments
 */
window.onWalkDismiss = function(callback) {
  onDismissCallback = callback;
};

// Helper function to format date with calendar module fallback
function formatDateWithFallback(date) {
  return window.calendarModule ? window.calendarModule.formatDate(date) : formatDateLocal(date);
}

function showDistanceModal(event, date = null) {
  popupDate = date;
  popupEvent = event;
  isEdit = !!event;

  const selectedDate = formatDateWithFallback(popupDate);
  let distanceValue = '';
  
  if (event && event.title) {
    distanceValue = event.title.replace(/\s*km$/, '');
  }



  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  document.body.appendChild(modalOverlay);
  const preact = window.preact;
  const islands = window.preactIslands;

  if (!preact || !preact.render || !preact.h || !islands || !islands.DistanceModal) {
    console.error('DistanceModal island not available. Ensure islands.js is loaded before progress.js');
    modalOverlay.remove();
    return;
  }
  const { render, h } = preact;
  const { DistanceModal } = islands;
  render(
    h(DistanceModal, {
      selectedDate,
      distanceValue,
      isEdit
    }),
    modalOverlay
  );

  // Track if save/delete was triggered (to distinguish from dismiss)
  let actionTaken = false;

  function unmountAndRemoveModal() {
    try {
      render(null, modalOverlay);
    } catch (e) {
      // Ignore unmount errors; removing the container is sufficient cleanup.
    }
    modalOverlay.remove();
  }

  // Helper function to add to current distance
  function addToDistance(amount) {
    const input = document.getElementById('distance-input');
    const current = parseFloat(input.value) || 0;
    input.value = (current + amount).toFixed(2);
    // Trigger input event for any validation listeners
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function closeModal(wasDismissed = true) {
    // Clean up ESC key listener
    cleanupEscKeyListener();
    unmountAndRemoveModal();
    // Only call dismiss callback if no action was taken (user cancelled)
    if (wasDismissed && !actionTaken && onDismissCallback) {
      onDismissCallback();
    }
  }

  // Wrap save/delete handlers to track that action was taken
  function handleSaveWithTracking() {
    actionTaken = true;
    handleSaveDistance();
  }

  function handleDeleteWithTracking() {
    actionTaken = true;
    handleDeleteDistance();
  }

  // Add event listeners
  document.getElementById('save-btn').addEventListener('click', handleSaveWithTracking);
  document.getElementById('cancel-btn').addEventListener('click', () => closeModal(true));
  
  // Quick entry button handlers
  document.getElementById('quick-add-1').addEventListener('click', function() {
    addToDistance(1);
  });
  document.getElementById('quick-add-5').addEventListener('click', function() {
    addToDistance(5);
  });
  document.getElementById('quick-reset').addEventListener('click', function() {
    const input = document.getElementById('distance-input');
    input.value = '0.00';
    // Trigger input event for any validation listeners
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  
  const closeModalBtn = document.getElementById('close-modal');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => closeModal(true));
  }
  
  if (isEdit) {
    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', handleDeleteWithTracking);
    }
  }

  // Close modal when clicking overlay
  modalOverlay.addEventListener('click', function(e) {
    if (e.target === modalOverlay) {
      closeModal(true);
    }
  });

  // Close modal with ESC key
  escKeyHandler = function handleEscKey(e) {
    if (e.key === 'Escape') {
      closeModal(true);
    }
  };
  document.addEventListener('keydown', escKeyHandler);

  // Focus on input
  setTimeout(() => {
    document.getElementById('distance-input').focus();
  }, 100);
}

function handleSaveDistance() {
  const distance = document.getElementById('distance-input').value;
  const selectedDate = formatDateWithFallback(popupDate);
  
  if (!distance || isNaN(distance) || Number(distance) < 0) {
    alert('Please enter a valid distance');
    return;
  }

  // Get current total before updating
  const events = window.calendarModule ? window.calendarModule.events() : [];
  const currentTotal = events.reduce((acc, ev) => acc + Number(ev.title.replace(/\s*km$/, '')), 0);
  
  if (isEdit) {
    // For edits, we need to subtract the old distance and add the new one
    const oldDistance = Number(popupEvent.title.replace(/\s*km$/, ''));
    const newDistance = Number(distance);
    const previousTotal = currentTotal - oldDistance;
    const projectedNewTotal = previousTotal + newDistance;
    
    popupEvent.title = distance;
    fetch('/api/calendar-progress', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        ...window.getAuthHeaders()
      },
      body: JSON.stringify({ start: selectedDate, title: distance })
    }).then(response => response).then(() => {
      if (window.updateCalendarAndTotal) {
        window.updateCalendarAndTotal();
      }
      // Trigger onWalkSaved callback for Map island integration
      if (onWalkSavedCallback) {
        onWalkSavedCallback({ action: 'update', date: selectedDate, distance: newDistance });
      }
      // Check for newly passed goals after calendar update
      if (window.goalsModule && window.goalsModule.checkForNewlyPassedGoals) {
        window.goalsModule.checkForNewlyPassedGoals(previousTotal, projectedNewTotal).then(newlyPassedGoal => {
          if (newlyPassedGoal && window.goalsModule.showGoalModal) {
            setTimeout(() => window.goalsModule.showGoalModal(newlyPassedGoal, projectedNewTotal, true), 500);
          }
        });
      }
    });
  } else {
    const newDistance = Number(distance);
    const projectedNewTotal = currentTotal + newDistance;
    
    // Update local events array before making the API call
    if (window.calendarModule && window.calendarModule.setEvents) {
      const currentEvents = window.calendarModule.events();
      currentEvents.push({ start: selectedDate, title: distance });
      window.calendarModule.setEvents(currentEvents);
    }
    
    fetch('/api/calendar-progress', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...window.getAuthHeaders()
      },
      body: JSON.stringify({ start: selectedDate, title: distance })
    }).then(response => response).then(() => {
      if (window.updateCalendarAndTotal) {
        window.updateCalendarAndTotal();
      }
      // Trigger onWalkSaved callback for Map island integration
      if (onWalkSavedCallback) {
        onWalkSavedCallback({ action: 'save', date: selectedDate, distance: newDistance });
      }
      // Check for newly passed goals after calendar update
      if (window.goalsModule && window.goalsModule.checkForNewlyPassedGoals) {
        window.goalsModule.checkForNewlyPassedGoals(currentTotal, projectedNewTotal).then(newlyPassedGoal => {
          if (newlyPassedGoal && window.goalsModule.showGoalModal) {
            setTimeout(() => window.goalsModule.showGoalModal(newlyPassedGoal, projectedNewTotal, true), 500);
          }
        });
      }
    });
  }
  
  // Close modal
  cleanupEscKeyListener();
  const modalOverlay = document.querySelector('.modal-overlay');
  if (modalOverlay) {
    const preact = window.preact;
    if (preact && preact.render) {
      try {
        preact.render(null, modalOverlay);
      } catch (e) {
        // Ignore unmount errors; removing the container is sufficient cleanup.
      }
    }
    modalOverlay.remove();
  }
}

function handleDeleteDistance() {
  const selectedDate = formatDateWithFallback(popupDate);
  
  fetch('/api/calendar-progress', {
    method: 'DELETE',
    headers: { 
      'Content-Type': 'application/json',
      ...window.getAuthHeaders()
    },
    body: JSON.stringify({ start: selectedDate })
  }).then(response => response).then(() => {
    if (window.updateCalendarAndTotal) {
      window.updateCalendarAndTotal();
    }
    // Trigger onWalkSaved callback for Map island integration
    if (onWalkSavedCallback) {
      onWalkSavedCallback({ action: 'delete', date: selectedDate });
    }
  }).catch(error => {
    console.error('Error deleting progress:', error);
  });
  
  // Close modal
  cleanupEscKeyListener();
  const modalOverlay = document.querySelector('.modal-overlay');
  if (modalOverlay) {
    const preact = window.preact;
    if (preact && preact.render) {
      try {
        preact.render(null, modalOverlay);
      } catch (e) {
        // Ignore unmount errors; removing the container is sufficient cleanup.
      }
    }
    modalOverlay.remove();
  }
}



// Fallback date formatting function
function formatDateLocal(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function fetchAndUpdateTotalDistance() {
  try {
    const response = await fetch('/api/total-distance', {
      headers: window.getAuthHeaders()
    });
    if (response.ok) {
      const data = await response.json();
      const el = document.getElementById('total-distance-value');
      if (el) el.textContent = `${data.totalDistance} km`;
      if (window.goalsModule && window.goalsModule.renderGoals) {
        window.goalsModule.renderGoals(data.totalDistance);
      }
    } else if (response.status === 401) {
      // User not authenticated - this is handled by the overall auth flow
    } else {
      console.error('Failed to fetch total distance:', response.status);
      const el = document.getElementById('total-distance-value');
      if (el) el.textContent = '0 km';
    }
  } catch (error) {
    console.error('Error fetching total distance:', error);
    const el = document.getElementById('total-distance-value');
    if (el) el.textContent = '0 km';
  }
}

// Export functions for use by other modules
window.progressModule = {
  showDistanceModal,
  handleSaveDistance,
  handleDeleteDistance,
  fetchAndUpdateTotalDistance
};

// Make functions available globally for compatibility
window.showProgressModal = showDistanceModal;
window.showDistanceModal = showDistanceModal; // Map island integration
window.fetchAndUpdateTotalDistance = fetchAndUpdateTotalDistance;
