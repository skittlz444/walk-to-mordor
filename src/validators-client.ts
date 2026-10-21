/**
 * Browser entry point for the shared validators.
 *
 * Bundled by scripts/generate-client-validators.js into
 * public/js/validators.js, which exposes `window.validators` for the legacy
 * scripts. Core date/distance rules live in ./validators.ts and are shared with
 * the Worker; only the presentation helpers below are browser-specific.
 */
import {
  VALIDATION_CONSTANTS,
  isValidDateFormat,
  isValidDistance,
} from './validators';

function validateProgressInput(date: string, distance: unknown): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

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

  return { isValid: errors.length === 0, errors };
}

function sanitizeInput(input: unknown): unknown {
  if (typeof input !== 'string') {
    return input;
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function formatDistanceDisplay(distance: unknown): string {
  const num = Number(distance);
  if (isNaN(num)) return '0.00';

  return num.toFixed(2);
}

function formatDateDisplay(dateStr: string): string {
  if (!isValidDateFormat(dateStr)) {
    return dateStr;
  }

  try {
    // Parse with split to avoid the UTC shift of new Date("YYYY-MM-DD").
    const parts = dateStr.split('-');
    const date = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
    );
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (_error) {
    return dateStr;
  }
}

const validators = {
  isValidDateFormat,
  isValidDistance,
  validateProgressInput,
  sanitizeInput,
  formatDistanceDisplay,
  formatDateDisplay,
  VALIDATION_CONSTANTS,
};

(globalThis as unknown as { validators: typeof validators }).validators = validators;
