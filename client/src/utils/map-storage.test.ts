import { describe, it, expect, beforeEach } from 'vitest';
import {
  LAST_OPENED_DISTANCE_KEY,
  readLastOpenedDistanceMiles,
  writeLastOpenedDistanceMiles,
} from './map-storage';

describe('map-storage localStorage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no stored value exists', () => {
    expect(readLastOpenedDistanceMiles(localStorage)).toBeNull();
  });

  it('returns null for non-numeric stored values', () => {
    localStorage.setItem(LAST_OPENED_DISTANCE_KEY, 'not-a-number');
    expect(readLastOpenedDistanceMiles(localStorage)).toBeNull();
  });

  it('returns null for non-finite stored values', () => {
    localStorage.setItem(LAST_OPENED_DISTANCE_KEY, 'Infinity');
    expect(readLastOpenedDistanceMiles(localStorage)).toBeNull();
  });

  it('reads a valid stored distance', () => {
    localStorage.setItem(LAST_OPENED_DISTANCE_KEY, '123.45');
    expect(readLastOpenedDistanceMiles(localStorage)).toBe(123.45);
  });

  it('writes a valid distance to localStorage', () => {
    writeLastOpenedDistanceMiles(localStorage, 42.5);
    expect(localStorage.getItem(LAST_OPENED_DISTANCE_KEY)).toBe('42.5');
  });

  it('does not write invalid distances to localStorage', () => {
    writeLastOpenedDistanceMiles(localStorage, Number.NaN);
    expect(localStorage.getItem(LAST_OPENED_DISTANCE_KEY)).toBeNull();
  });
});
