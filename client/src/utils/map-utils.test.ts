import { describe, it, expect } from 'vitest';
import {
  calculateCutoffPoint,
  clamp,
  dynamicStrokeWidth,
  truncateFuturePath,
  computePathLength,
} from './map-utils';
import type { PathNode } from '../data/paths/fellowship-path';

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to min', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });

  it('clamps to max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('dynamicStrokeWidth', () => {
  it('returns baseWidth / scale when within bounds', () => {
    expect(dynamicStrokeWidth(6, 1)).toBe(6);
    expect(dynamicStrokeWidth(6, 2)).toBe(3);
  });

  it('clamps to min width', () => {
    // 6 / 10 = 0.6, min is 2
    expect(dynamicStrokeWidth(6, 10, 2, 10)).toBe(2);
  });

  it('clamps to max width', () => {
    // 6 / 0.1 = 60, max is 10
    expect(dynamicStrokeWidth(6, 0.1, 2, 10)).toBe(10);
  });
});

describe('calculateCutoffPoint', () => {
  it('returns empty arrays for empty path', () => {
    const result = calculateCutoffPoint([], 100);
    expect(result.completedPoints).toEqual([]);
    expect(result.futurePoints).toEqual([]);
  });

  it('returns all future when user has zero distance', () => {
    const path: PathNode[] = [
      { x: 0, y: 0, distance: 0 },
      { x: 10, y: 0, distance: 10 },
      { x: 20, y: 0, distance: 20 },
    ];
    const result = calculateCutoffPoint(path, 0);
    expect(result.completedPoints).toEqual([]);
    expect(result.futurePoints).toEqual([0, 0, 10, 0, 20, 0]);
  });

  it('returns all completed when user is at or past final anchor', () => {
    const path: PathNode[] = [
      { x: 0, y: 0, distance: 0 },
      { x: 10, y: 0, distance: 10 },
      { x: 20, y: 0, distance: 20 },
    ];
    const result = calculateCutoffPoint(path, 20);
    expect(result.completedPoints).toEqual([0, 0, 10, 0, 20, 0]);
    expect(result.futurePoints).toEqual([]);
  });

  it('splits at midpoint when user is halfway between anchors (no intermediates)', () => {
    const path: PathNode[] = [
      { x: 0, y: 0, distance: 0 },
      { x: 20, y: 0, distance: 20 },
    ];
    const result = calculateCutoffPoint(path, 10);
    // 50% between (0,0) and (20,0) = (10,0)
    expect(result.completedPoints).toEqual([0, 0, 10, 0]);
    expect(result.futurePoints[0]).toBe(10);
    expect(result.futurePoints[1]).toBe(0);
    // Future should end at (20,0)
    expect(result.futurePoints[result.futurePoints.length - 2]).toBe(20);
    expect(result.futurePoints[result.futurePoints.length - 1]).toBe(0);
  });

  it('correctly interpolates with geometry-only points (null distance)', () => {
    // Anchor A (0km) -> Point B (null) -> Point C (null) -> Anchor D (10km)
    // A=(0,0), B=(10,0), C=(20,0), D=(30,0) — total geometric = 30 units
    const path: PathNode[] = [
      { x: 0, y: 0, distance: 0 },
      { x: 10, y: 0, distance: null },
      { x: 20, y: 0, distance: null },
      { x: 30, y: 0, distance: 10 },
    ];

    // At 5km = 50% → target pixel = 0.5 * 30 = 15 pixels
    // A→B = 10px (accumulated = 10), B→C = 10px (accumulated = 20)
    // 15 pixels falls in B→C at t = (15-10)/10 = 0.5 → x = 10 + 0.5*10 = 15
    const result = calculateCutoffPoint(path, 5);
    const lastCompletedX = result.completedPoints[result.completedPoints.length - 2];
    const lastCompletedY = result.completedPoints[result.completedPoints.length - 1];
    expect(lastCompletedX).toBeCloseTo(15, 5);
    expect(lastCompletedY).toBeCloseTo(0, 5);
  });

  it('handles user distance at first anchor start', () => {
    const path: PathNode[] = [
      { x: 0, y: 0, distance: 0 },
      { x: 10, y: 10, distance: 100 },
    ];
    // At distance 0, user is at first anchor — no completed path
    const result = calculateCutoffPoint(path, 0);
    expect(result.completedPoints).toEqual([]);
    expect(result.futurePoints.length).toBeGreaterThan(0);
  });

  it('correctly splits with multiple anchor segments', () => {
    const path: PathNode[] = [
      { x: 0, y: 0, distance: 0 },
      { x: 10, y: 0, distance: 10 },
      { x: 20, y: 0, distance: 20 },
      { x: 30, y: 0, distance: 30 },
    ];

    // At 15: between anchor (10,0)@d=10 and (20,0)@d=20 → 50% → (15,0)
    const result = calculateCutoffPoint(path, 15);
    const lastX = result.completedPoints[result.completedPoints.length - 2];
    expect(lastX).toBeCloseTo(15, 5);

    // Future should start at (15,0) and include (20,0) and (30,0)
    expect(result.futurePoints[0]).toBeCloseTo(15, 5);
  });

  it('returns all future when no anchors exist', () => {
    const path: PathNode[] = [
      { x: 0, y: 0, distance: null },
      { x: 10, y: 10, distance: null },
    ];
    const result = calculateCutoffPoint(path, 5);
    expect(result.completedPoints).toEqual([]);
    expect(result.futurePoints).toEqual([0, 0, 10, 10]);
  });

  it('handles vertical path segments correctly', () => {
    const path: PathNode[] = [
      { x: 0, y: 0, distance: 0 },
      { x: 0, y: 100, distance: 100 },
    ];
    // At 50: 50% along vertical line → (0, 50)
    const result = calculateCutoffPoint(path, 50);
    const lastX = result.completedPoints[result.completedPoints.length - 2];
    const lastY = result.completedPoints[result.completedPoints.length - 1];
    expect(lastX).toBeCloseTo(0, 5);
    expect(lastY).toBeCloseTo(50, 5);
  });

  it('handles user distance beyond final anchor gracefully', () => {
    const path: PathNode[] = [
      { x: 0, y: 0, distance: 0 },
      { x: 10, y: 0, distance: 10 },
    ];
    const result = calculateCutoffPoint(path, 999);
    expect(result.completedPoints).toEqual([0, 0, 10, 0]);
    expect(result.futurePoints).toEqual([]);
  });
});

describe('truncateFuturePath', () => {
  it('returns original if fewer than 4 values', () => {
    expect(truncateFuturePath([10, 20], 100)).toEqual([10, 20]);
  });

  it('returns original if path is within limit', () => {
    // Two points 10px apart, max is 100
    const pts = [0, 0, 10, 0];
    expect(truncateFuturePath(pts, 100)).toEqual([0, 0, 10, 0]);
  });

  it('truncates at max pixel length', () => {
    // Three points: (0,0) -> (10,0) -> (20,0), total = 20px, max = 15px
    const pts = [0, 0, 10, 0, 20, 0];
    const result = truncateFuturePath(pts, 15);
    // Should stop at x=15
    expect(result.length).toBe(6); // 3 points
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(10);
    expect(result[3]).toBe(0);
    expect(result[4]).toBeCloseTo(15, 5);
    expect(result[5]).toBeCloseTo(0, 5);
  });

  it('truncates exactly at segment boundary', () => {
    const pts = [0, 0, 10, 0, 20, 0];
    const result = truncateFuturePath(pts, 10);
    expect(result.length).toBe(4); // 2 points
    expect(result[2]).toBeCloseTo(10, 5);
  });
});

describe('computePathLength', () => {
  it('returns 0 for fewer than 4 values', () => {
    expect(computePathLength([0, 0])).toBe(0);
  });

  it('computes horizontal distance', () => {
    expect(computePathLength([0, 0, 10, 0])).toBe(10);
  });

  it('computes multi-segment length', () => {
    // (0,0) -> (3,4) -> (3,4+5) = 5 + 5 = 10
    expect(computePathLength([0, 0, 3, 4, 3, 9])).toBe(10);
  });
});
