// Progress domain functions

// Progress-related state
let popupEvent;
let popupDate;
let isEdit = false;

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
  modalOverlay.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-body">
          <div class="form-group">
            <label>Date: ${selectedDate}</label>
          </div>
          <div class="form-group">
            <label for="distance-input">Distance (km):</label>
            <div class="input-group">
              <input type="number" id="distance-input" step="any" min="0" value="${distanceValue}" placeholder="0.00">
            </div>
          </div>
        </div>
        <div class="modal-footer modal-footer-full">
          <div class="modal-footer-btns modal-footer-btns-edit">
            ${isEdit ? '<button type="button" class="btn btn-danger" id="delete-btn">Delete</button>' : ''}
            <button type="button" class="btn btn-primary" id="save-btn">${isEdit ? 'Save' : 'Add'}</button>
            <button type="button" class="btn btn-secondary" id="cancel-btn">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  // Add event listeners
  document.getElementById('save-btn').addEventListener('click', handleSaveDistance);
  document.getElementById('cancel-btn').addEventListener('click', closeModal);
  
  const closeModalBtn = document.getElementById('close-modal');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
  }
  
  if (isEdit) {
    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', handleDeleteDistance);
    }
  }

  // Close modal when clicking overlay
  modalOverlay.addEventListener('click', function(e) {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  // Focus on input
  setTimeout(() => {
    document.getElementById('distance-input').focus();
  }, 100);

  function closeModal() {
    modalOverlay.remove();
  }
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
    fetch('/wtm/api/calendar-progress', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ start: selectedDate, title: distance })
    }).then(response => response).then(() => {
      if (window.updateCalendarAndTotal) {
        window.updateCalendarAndTotal();
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
    
    fetch('/wtm/api/calendar-progress', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ start: selectedDate, title: distance })
    }).then(response => response).then(() => {
      if (window.updateCalendarAndTotal) {
        window.updateCalendarAndTotal();
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
  document.querySelector('.modal-overlay').remove();
}

function handleDeleteDistance() {
  const selectedDate = formatDateWithFallback(popupDate);
  
  fetch('/wtm/api/calendar-progress', {
    method: 'DELETE',
    headers: { 
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ start: selectedDate })
  }).then(response => response).then(() => {
    if (window.updateCalendarAndTotal) {
      window.updateCalendarAndTotal();
    }
  }).catch(error => {
    console.error('Error deleting progress:', error);
  });
  
  // Close modal
  document.querySelector('.modal-overlay').remove();
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
    const response = await fetch('/wtm/api/total-distance');
    if (response.ok) {
      const data = await response.json();
      document.getElementById('total-distance-value').textContent = `${data.totalDistance} km`;
      if (window.goalsModule && window.goalsModule.renderGoals) {
        window.goalsModule.renderGoals(data.totalDistance);
      }
    } else if (response.status === 401) {
      // User not authenticated - this is handled by the overall auth flow
    } else {
      console.error('Failed to fetch total distance:', response.status);
      document.getElementById('total-distance-value').textContent = '0 km';
    }
  } catch (error) {
    console.error('Error fetching total distance:', error);
    document.getElementById('total-distance-value').textContent = '0 km';
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
window.fetchAndUpdateTotalDistance = fetchAndUpdateTotalDistance;