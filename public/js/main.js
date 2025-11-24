// Main application controller - coordinates domain modules

document.addEventListener("DOMContentLoaded", function() {
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
