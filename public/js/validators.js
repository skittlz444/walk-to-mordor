// Client-side validators

// Validation constants - keep in sync with server-side validators.ts
// Year range 1000-9999 provides a reasonable range for date validation
// while supporting historical dates and far future dates if needed
const VALIDATION_CONSTANTS = {
  MIN_YEAR: 1000,
  MAX_YEAR: 9999,
  MAX_DISTANCE_VALUE: 999999999
};

function isValidDateFormat(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return false;
  }
  
  // Check if format matches YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return false;
  }
  
  // Parse and validate the actual date
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  
  // Basic range checks - use shared constants
  if (year < VALIDATION_CONSTANTS.MIN_YEAR || year > VALIDATION_CONSTANTS.MAX_YEAR) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  
  // Create date and verify it matches input (handles invalid dates like Feb 30)
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && 
         date.getMonth() === month - 1 && 
         date.getDate() === day;
}

function isValidDistance(distance) {
  if (typeof distance === 'undefined' || distance === null) {
    return false;
  }
  
  const num = Number(distance);
  
  // Check if it's a valid number
  if (isNaN(num) || !isFinite(num)) {
    return false;
  }
  
  // Check if it's non-negative
  if (num < 0) {
    return false;
  }
  
  // Check if it's within reasonable bounds (less than 1 billion)
  if (num > VALIDATION_CONSTANTS.MAX_DISTANCE_VALUE) {
    return false;
  }
  
  return true;
}

function validateProgressInput(date, distance) {
  const errors = [];
  
  if (!date) {
    errors.push('Date is required');
  } else if (!isValidDateFormat(date)) {
    errors.push('Invalid date format. Expected format: YYYY-MM-DD (e.g., 2024-01-15)');
  }
  
  if (typeof distance === 'undefined' || distance === null || distance === '') {
    errors.push('Distance is required');
  } else if (!isValidDistance(distance)) {
    const num = Number(distance);
    if (isNaN(num) || !isFinite(num)) {
      errors.push('Invalid distance value. Must be a valid number');
    } else if (num < 0) {
      errors.push('Invalid distance value. Must be non-negative (0 or greater)');
    } else if (num > VALIDATION_CONSTANTS.MAX_DISTANCE_VALUE) {
      errors.push('Invalid distance value. Must be less than 1 billion');
    } else {
      errors.push('Invalid distance value. Must be a non-negative number');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }
  
  // Basic HTML escaping
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function formatDistanceDisplay(distance) {
  const num = Number(distance);
  if (isNaN(num)) return '0.00';
  
  return num.toFixed(2);
}

function formatDateDisplay(dateStr) {
  if (!isValidDateFormat(dateStr)) {
    return dateStr; // Return as-is if invalid
  }
  
  try {
    // Parse with split to avoid timezone shift from new Date("YYYY-MM-DD") being UTC
    const parts = dateStr.split('-');
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return dateStr; // Return as-is if parsing fails
  }
}

// Export validators for use by other modules
window.validators = {
  isValidDateFormat,
  isValidDistance,
  validateProgressInput,
  sanitizeInput,
  formatDistanceDisplay,
  formatDateDisplay
};