import { describe, it, expect } from 'vitest';
import {
  VALIDATION_CONSTANTS,
  isValidDateFormat,
  isValidDistance,
  validateProgressInput,
  sanitizeInput,
  formatDistanceDisplay,
  formatDateDisplay,
} from './validators';

// ---------------------------------------------------------------------------
// isValidDateFormat
// ---------------------------------------------------------------------------
describe('isValidDateFormat', () => {
  it('accepts a valid date', () => {
    expect(isValidDateFormat('2024-01-15')).toBe(true);
  });

  it('accepts leap-day on a leap year', () => {
    expect(isValidDateFormat('2024-02-29')).toBe(true);
  });

  it('rejects leap-day on a non-leap year', () => {
    expect(isValidDateFormat('2023-02-29')).toBe(false);
  });

  it('rejects an impossible day (Feb 30)', () => {
    expect(isValidDateFormat('2024-02-30')).toBe(false);
  });

  it('rejects month 0', () => {
    expect(isValidDateFormat('2024-00-15')).toBe(false);
  });

  it('rejects month 13', () => {
    expect(isValidDateFormat('2024-13-01')).toBe(false);
  });

  it('rejects day 0', () => {
    expect(isValidDateFormat('2024-01-00')).toBe(false);
  });

  it('rejects day 32', () => {
    expect(isValidDateFormat('2024-01-32')).toBe(false);
  });

  it('rejects year below MIN_YEAR', () => {
    expect(isValidDateFormat('0999-06-15')).toBe(false);
  });

  it('accepts year at MIN_YEAR boundary', () => {
    expect(isValidDateFormat('1000-01-01')).toBe(true);
  });

  it('accepts year at MAX_YEAR boundary', () => {
    expect(isValidDateFormat('9999-12-31')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidDateFormat('')).toBe(false);
  });

  it('rejects wrong format (MM/DD/YYYY)', () => {
    expect(isValidDateFormat('01/15/2024')).toBe(false);
  });

  it('rejects partial date', () => {
    expect(isValidDateFormat('2024-01')).toBe(false);
  });

  it('rejects date with extra characters', () => {
    expect(isValidDateFormat('2024-01-15T00:00')).toBe(false);
  });

  it('rejects non-numeric segments', () => {
    expect(isValidDateFormat('abcd-ef-gh')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidDistance
// ---------------------------------------------------------------------------
describe('isValidDistance', () => {
  it('accepts zero', () => {
    expect(isValidDistance(0)).toBe(true);
  });

  it('accepts a positive integer', () => {
    expect(isValidDistance(42)).toBe(true);
  });

  it('accepts a positive float', () => {
    expect(isValidDistance(3.14)).toBe(true);
  });

  it('accepts a numeric string', () => {
    expect(isValidDistance('10.5')).toBe(true);
  });

  it('rejects a negative number', () => {
    expect(isValidDistance(-1)).toBe(false);
  });

  it('rejects NaN', () => {
    expect(isValidDistance(NaN)).toBe(false);
  });

  it('rejects Infinity', () => {
    expect(isValidDistance(Infinity)).toBe(false);
  });

  it('rejects -Infinity', () => {
    expect(isValidDistance(-Infinity)).toBe(false);
  });

  it('rejects a non-numeric string', () => {
    expect(isValidDistance('abc')).toBe(false);
  });

  it('accepts the max allowed value', () => {
    expect(isValidDistance(VALIDATION_CONSTANTS.MAX_DISTANCE_VALUE)).toBe(true);
  });

  it('rejects a value exceeding max', () => {
    expect(isValidDistance(VALIDATION_CONSTANTS.MAX_DISTANCE_VALUE + 1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateProgressInput
// ---------------------------------------------------------------------------
describe('validateProgressInput', () => {
  it('returns valid for correct inputs', () => {
    const result = validateProgressInput('2024-06-15', 5);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns error when date is missing', () => {
    const result = validateProgressInput(undefined, 5);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Date is required');
  });

  it('returns error when date is null', () => {
    const result = validateProgressInput(null, 5);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Date is required');
  });

  it('returns error for invalid date format', () => {
    const result = validateProgressInput('not-a-date', 5);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/Invalid date format/);
  });

  it('returns error when distance is missing', () => {
    const result = validateProgressInput('2024-06-15', undefined);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Distance is required');
  });

  it('returns error when distance is null', () => {
    const result = validateProgressInput('2024-06-15', null);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Distance is required');
  });

  it('returns error when distance is empty string', () => {
    const result = validateProgressInput('2024-06-15', '');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Distance is required');
  });

  it('returns error for non-numeric distance', () => {
    const result = validateProgressInput('2024-06-15', 'abc');
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/Must be a valid number/);
  });

  it('returns error for negative distance', () => {
    const result = validateProgressInput('2024-06-15', -5);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/Must be non-negative/);
  });

  it('returns error for distance exceeding max', () => {
    const result = validateProgressInput('2024-06-15', 1_000_000_000);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/Must be less than 1 billion/);
  });

  it('collects both date and distance errors', () => {
    const result = validateProgressInput('', undefined);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// sanitizeInput
// ---------------------------------------------------------------------------
describe('sanitizeInput', () => {
  it('escapes ampersands', () => {
    expect(sanitizeInput('a&b')).toBe('a&amp;b');
  });

  it('escapes angle brackets', () => {
    expect(sanitizeInput('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(sanitizeInput('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(sanitizeInput("it's")).toBe("it&#x27;s");
  });

  it('escapes forward slashes', () => {
    expect(sanitizeInput('a/b')).toBe('a&#x2F;b');
  });

  it('returns non-string values unchanged', () => {
    expect(sanitizeInput(42)).toBe(42);
    expect(sanitizeInput(null)).toBe(null);
    expect(sanitizeInput(undefined)).toBe(undefined);
  });

  it('handles strings with multiple special characters', () => {
    expect(sanitizeInput('<a href="/">')).toBe(
      '&lt;a href=&quot;&#x2F;&quot;&gt;',
    );
  });
});

// ---------------------------------------------------------------------------
// formatDistanceDisplay
// ---------------------------------------------------------------------------
describe('formatDistanceDisplay', () => {
  it('formats an integer to two decimals', () => {
    expect(formatDistanceDisplay(5)).toBe('5.00');
  });

  it('formats a float to two decimals', () => {
    expect(formatDistanceDisplay(3.1)).toBe('3.10');
  });

  it('rounds to two decimals', () => {
    expect(formatDistanceDisplay(1.999)).toBe('2.00');
  });

  it('handles zero', () => {
    expect(formatDistanceDisplay(0)).toBe('0.00');
  });

  it('handles numeric strings', () => {
    expect(formatDistanceDisplay('7.5')).toBe('7.50');
  });

  it('returns "0.00" for non-numeric input', () => {
    expect(formatDistanceDisplay('abc')).toBe('0.00');
  });
});

// ---------------------------------------------------------------------------
// formatDateDisplay
// ---------------------------------------------------------------------------
describe('formatDateDisplay', () => {
  it('formats a valid date into a human-readable string', () => {
    const result = formatDateDisplay('2024-01-15');
    // The exact output depends on locale, but it should include the year
    expect(result).toContain('2024');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
  });

  it('returns the input unchanged for invalid dates', () => {
    expect(formatDateDisplay('not-a-date')).toBe('not-a-date');
  });

  it('returns the input unchanged for empty string', () => {
    expect(formatDateDisplay('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// VALIDATION_CONSTANTS
// ---------------------------------------------------------------------------
describe('VALIDATION_CONSTANTS', () => {
  it('exposes expected constant values', () => {
    expect(VALIDATION_CONSTANTS.MIN_YEAR).toBe(1000);
    expect(VALIDATION_CONSTANTS.MAX_YEAR).toBe(9999);
    expect(VALIDATION_CONSTANTS.MAX_DISTANCE_VALUE).toBe(999_999_999);
  });
});
