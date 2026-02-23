/**
 * Client-side validation and formatting utilities.
 *
 * TypeScript module mirroring the public/js/validators.js API
 * for use by Preact components via named imports.
 */

/** Validation constants kept in sync with server-side validators. */
export const VALIDATION_CONSTANTS = {
  /** Minimum supported year for date validation. */
  MIN_YEAR: 1000,
  /** Maximum supported year for date validation. */
  MAX_YEAR: 9999,
  /** Upper bound for distance values (exclusive of 1 billion). */
  MAX_DISTANCE_VALUE: 999_999_999,
} as const;

/** Result returned by {@link validateProgressInput}. */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Check whether a string is a valid `YYYY-MM-DD` date.
 *
 * Validates format, range (year 1000–9999), and calendar correctness
 * (e.g. rejects Feb 30).
 *
 * @param dateStr - The date string to validate.
 * @returns `true` when the string represents a real calendar date.
 */
export function isValidDateFormat(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') {
    return false;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return false;
  }

  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (year < VALIDATION_CONSTANTS.MIN_YEAR || year > VALIDATION_CONSTANTS.MAX_YEAR) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Check whether a value represents a valid, non-negative distance.
 *
 * Accepts numbers or numeric strings. The value must be finite,
 * non-negative, and less than 1 billion.
 *
 * @param distance - The value to validate.
 * @returns `true` when the value is a usable distance.
 */
export function isValidDistance(distance: number | string): boolean {
  if (distance === undefined || distance === null) {
    return false;
  }

  const num = Number(distance);

  if (isNaN(num) || !isFinite(num)) {
    return false;
  }

  if (num < 0) {
    return false;
  }

  if (num > VALIDATION_CONSTANTS.MAX_DISTANCE_VALUE) {
    return false;
  }

  return true;
}

/**
 * Validate a date + distance pair for progress entry.
 *
 * Returns a {@link ValidationResult} containing any error messages.
 *
 * @param date     - Date string (expected `YYYY-MM-DD`).
 * @param distance - Distance value (number or numeric string).
 * @returns Validation outcome with collected error messages.
 */
export function validateProgressInput(
  date: string | undefined | null,
  distance: number | string | undefined | null,
): ValidationResult {
  const errors: string[] = [];

  if (!date) {
    errors.push('Date is required');
  } else if (!isValidDateFormat(date)) {
    errors.push('Invalid date format. Expected format: YYYY-MM-DD (e.g., 2024-01-15)');
  }

  if (distance === undefined || distance === null || distance === '') {
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

/**
 * Escape HTML special characters in a string to prevent XSS.
 *
 * Non-string values are returned unchanged.
 *
 * @param input - The value to sanitize.
 * @returns The escaped string, or the original value if not a string.
 */
export function sanitizeInput<T>(input: T): T | string {
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

/**
 * Format a numeric distance to two decimal places.
 *
 * Returns `"0.00"` for non-numeric inputs.
 *
 * @param distance - The distance value to format.
 * @returns A string with exactly two decimal places.
 */
export function formatDistanceDisplay(distance: number | string): string {
  const num = Number(distance);
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
}

/**
 * Format a `YYYY-MM-DD` date string into a human-readable display form.
 *
 * Example output: `"Wed, Jan 15, 2024"`.
 * Returns the original string unchanged if it is not a valid date.
 *
 * @param dateStr - A date string in `YYYY-MM-DD` format.
 * @returns A locale-formatted date string, or the original input on failure.
 */
export function formatDateDisplay(dateStr: string): string {
  if (!isValidDateFormat(dateStr)) {
    return dateStr;
  }

  try {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
