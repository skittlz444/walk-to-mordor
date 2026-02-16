import { describe, it, expect } from 'vitest';
import {
  getScreenPosition,
  getOptimalPopupPosition,
  calculateSafeZoneBounds,
  isWithinSafeZone,
  calculatePanOffset,
} from './map-popup-utils';

describe('getScreenPosition', () => {
  it('converts map coords to screen coords with no offset and scale 1', () => {
    const pos = getScreenPosition({ x: 100, y: 200 }, { x: 0, y: 0 }, 1);
    expect(pos).toEqual({ x: 100, y: 200 });
  });

  it('applies stage position offset', () => {
    const pos = getScreenPosition({ x: 100, y: 200 }, { x: -50, y: -100 }, 1);
    expect(pos).toEqual({ x: 50, y: 100 });
  });

  it('applies stage scale', () => {
    const pos = getScreenPosition({ x: 100, y: 200 }, { x: 0, y: 0 }, 2);
    expect(pos).toEqual({ x: 200, y: 400 });
  });

  it('applies both offset and scale', () => {
    const pos = getScreenPosition({ x: 100, y: 200 }, { x: -50, y: -100 }, 1.5);
    expect(pos).toEqual({ x: 100, y: 200 });
  });
});

describe('getOptimalPopupPosition', () => {
  const viewport = { width: 1024, height: 768 };
  const popupSize = { width: 280, height: 200 };

  it('prefers placement above when space is available', () => {
    const result = getOptimalPopupPosition(
      { x: 512, y: 400 },
      popupSize,
      viewport,
    );
    expect(result.placement).toBe('above');
    expect(result.y).toBeLessThan(400);
  });

  it('falls back to below when not enough space above', () => {
    const result = getOptimalPopupPosition(
      { x: 512, y: 50 },
      popupSize,
      viewport,
    );
    expect(result.placement).toBe('below');
    expect(result.y).toBeGreaterThan(50);
  });

  it('falls back to right when not enough vertical space', () => {
    const smallViewport = { width: 1024, height: 240 };
    const result = getOptimalPopupPosition(
      { x: 100, y: 120 },
      popupSize,
      smallViewport,
    );
    expect(result.placement).toBe('right');
  });

  it('clamps popup within viewport bounds', () => {
    const result = getOptimalPopupPosition(
      { x: 10, y: 400 },
      popupSize,
      viewport,
    );
    expect(result.x).toBeGreaterThanOrEqual(8);
    expect(result.y).toBeGreaterThanOrEqual(8);
    expect(result.x + popupSize.width).toBeLessThanOrEqual(viewport.width);
    expect(result.y + popupSize.height).toBeLessThanOrEqual(viewport.height);
  });

  it('keeps popup within viewport when waypoint is near right edge', () => {
    const result = getOptimalPopupPosition(
      { x: 1000, y: 400 },
      popupSize,
      viewport,
    );
    expect(result.x + popupSize.width).toBeLessThanOrEqual(viewport.width);
  });
});

describe('calculateSafeZoneBounds', () => {
  it('returns correct 25% margins for a 1000x800 viewport', () => {
    const bounds = calculateSafeZoneBounds(1000, 800);
    expect(bounds.minX).toBe(250);
    expect(bounds.maxX).toBe(750);
    expect(bounds.minY).toBe(200);
    expect(bounds.maxY).toBe(600);
  });

  it('returns correct bounds for small viewport', () => {
    const bounds = calculateSafeZoneBounds(400, 300);
    expect(bounds.minX).toBe(100);
    expect(bounds.maxX).toBe(300);
    expect(bounds.minY).toBe(75);
    expect(bounds.maxY).toBe(225);
  });
});

describe('isWithinSafeZone', () => {
  const bounds = calculateSafeZoneBounds(1000, 800);

  it('returns true for center point', () => {
    expect(isWithinSafeZone({ x: 500, y: 400 }, bounds)).toBe(true);
  });

  it('returns true for point at safe zone edge', () => {
    expect(isWithinSafeZone({ x: 250, y: 200 }, bounds)).toBe(true);
    expect(isWithinSafeZone({ x: 750, y: 600 }, bounds)).toBe(true);
  });

  it('returns false for point outside safe zone', () => {
    expect(isWithinSafeZone({ x: 100, y: 400 }, bounds)).toBe(false);
    expect(isWithinSafeZone({ x: 500, y: 100 }, bounds)).toBe(false);
    expect(isWithinSafeZone({ x: 800, y: 400 }, bounds)).toBe(false);
    expect(isWithinSafeZone({ x: 500, y: 700 }, bounds)).toBe(false);
  });
});

describe('calculatePanOffset', () => {
  const viewport = { width: 1000, height: 800 };
  const popupSize = { width: 280, height: 200 };

  it('returns null when waypoint is already in safe zone (mobile)', () => {
    const result = calculatePanOffset(
      { x: 500, y: 400 },
      popupSize,
      viewport,
      true,
    );
    expect(result).toBeNull();
  });

  it('returns null when combined center is already in safe zone (desktop)', () => {
    const result = calculatePanOffset(
      { x: 500, y: 400 },
      popupSize,
      viewport,
      false,
    );
    expect(result).toBeNull();
  });

  it('returns correct delta for mobile when marker is left of safe zone', () => {
    const result = calculatePanOffset(
      { x: 100, y: 400 },
      popupSize,
      viewport,
      true,
    );
    expect(result).not.toBeNull();
    expect(result!.dx).toBeGreaterThan(0); // needs to move right
    expect(result!.dy).toBe(0);
  });

  it('returns correct delta for mobile when marker is above safe zone', () => {
    const result = calculatePanOffset(
      { x: 500, y: 50 },
      popupSize,
      viewport,
      true,
    );
    expect(result).not.toBeNull();
    expect(result!.dx).toBe(0);
    expect(result!.dy).toBeGreaterThan(0); // needs to move down
  });

  it('returns correct delta for desktop with marker near edge', () => {
    const result = calculatePanOffset(
      { x: 900, y: 400 },
      popupSize,
      viewport,
      false,
    );
    // Desktop considers combined bounding box of marker + popup
    expect(result).not.toBeNull();
  });

  it('uses only marker position for mobile (ignores popup)', () => {
    // Marker in safe zone center — should return null regardless of popup size
    const result = calculatePanOffset(
      { x: 500, y: 400 },
      { width: 5000, height: 5000 }, // huge popup
      viewport,
      true,
    );
    expect(result).toBeNull();
  });

  it('handles corner case — marker at viewport corner', () => {
    const result = calculatePanOffset(
      { x: 0, y: 0 },
      popupSize,
      viewport,
      true,
    );
    expect(result).not.toBeNull();
    expect(result!.dx).toBeGreaterThan(0);
    expect(result!.dy).toBeGreaterThan(0);
  });
});
