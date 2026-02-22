import { describe, it, expect } from 'vitest';
import type { PathNode } from './paths/fellowship-path';
import type { Goal } from '../types/goal';
import {
  getWaypointCoordinates,
  getVisibilityTier,
  isMajorWaypoint,
  filterWaypointsByTier,
  filterWaypointsByRange,
  filterWaypointsByViewport,
  type Waypoint,
} from './waypoints';

// Simple path: 3 anchors, straight horizontal line
const testPath: PathNode[] = [
  { x: 0, y: 0, distance: 0 },
  { x: 100, y: 0, distance: 100 },
  { x: 200, y: 0, distance: 200 },
];

// Goals use km; path uses miles. KM_TO_MILES = 0.621371
// So a goal at 100 km → 62.14 miles
const KM_TO_MILES = 0.621371;

function makeGoal(id: number, distanceKm: number, title: string, special?: string): Goal {
  return { id, distance: distanceKm, title, special: special ?? null };
}

function makeWaypoint(
  id: number,
  distanceMiles: number,
  title: string,
  x: number,
  y: number,
  special: string | null = null,
): Waypoint {
  return { id, distance: distanceMiles, title, x, y, special, image_id: null };
}

describe('getWaypointCoordinates', () => {
  it('returns empty array for empty goals', () => {
    expect(getWaypointCoordinates(testPath, [])).toEqual([]);
  });

  it('calculates correct coordinates for a goal at the start', () => {
    const goals = [makeGoal(1, 0, 'Start')];
    const result = getWaypointCoordinates(testPath, goals);
    expect(result).toHaveLength(1);
    expect(result[0].x).toBeCloseTo(0, 0);
    expect(result[0].y).toBeCloseTo(0, 0);
    expect(result[0].title).toBe('Start');
  });

  it('calculates interpolated position for a goal between anchors', () => {
    // Goal at 80.47 km → 50 miles → 50% of first segment (0→100)
    const goals = [makeGoal(1, 80.47, 'Midway')];
    const result = getWaypointCoordinates(testPath, goals);
    expect(result).toHaveLength(1);
    // 80.47 km * 0.621371 ≈ 50 miles → x should be ≈50
    expect(result[0].x).toBeCloseTo(50, 0);
  });

  it('preserves special field', () => {
    const goals = [makeGoal(1, 0, 'Bag End', 'Start of journey')];
    const result = getWaypointCoordinates(testPath, goals);
    expect(result[0].special).toBe('Start of journey');
  });

  it('sets special to null when not provided', () => {
    const goals = [makeGoal(1, 0, 'Normal Goal')];
    const result = getWaypointCoordinates(testPath, goals);
    expect(result[0].special).toBeNull();
  });
});

describe('getVisibilityTier', () => {
  it('returns major for zoom < 0.8', () => {
    expect(getVisibilityTier(0.5)).toBe('major');
    expect(getVisibilityTier(0.79)).toBe('major');
  });

  it('returns expanded for zoom 0.8 - 1.69', () => {
    expect(getVisibilityTier(0.8)).toBe('expanded');
    expect(getVisibilityTier(1.0)).toBe('expanded');
    expect(getVisibilityTier(1.5)).toBe('expanded');
    expect(getVisibilityTier(1.69)).toBe('expanded');
  });

  it('returns all for zoom >= 1.7', () => {
    expect(getVisibilityTier(1.7)).toBe('all');
    expect(getVisibilityTier(2.0)).toBe('all');
    expect(getVisibilityTier(3.0)).toBe('all');
  });
});

describe('isMajorWaypoint', () => {
  it('returns true when special is set', () => {
    expect(isMajorWaypoint(makeWaypoint(1, 0, 'Bag End', 0, 0, 'Start'))).toBe(true);
  });

  it('returns false when special is null', () => {
    expect(isMajorWaypoint(makeWaypoint(1, 0, 'Normal', 0, 0, null))).toBe(false);
  });

  it('returns false when special is empty string', () => {
    expect(isMajorWaypoint(makeWaypoint(1, 0, 'Normal', 0, 0, ''))).toBe(false);
  });
});

describe('filterWaypointsByTier', () => {
  const waypoints: Waypoint[] = [
    makeWaypoint(1, 0, 'Major 1', 0, 0, 'special'),
    makeWaypoint(2, 10, 'Regular 1', 10, 0),
    makeWaypoint(3, 20, 'Regular 2', 20, 0),
    makeWaypoint(4, 30, 'Regular 3', 30, 0),
    makeWaypoint(5, 40, 'Major 2', 40, 0, 'special'),
    makeWaypoint(6, 50, 'Regular 4', 50, 0),
    makeWaypoint(7, 60, 'Regular 5', 60, 0),
    makeWaypoint(8, 70, 'Regular 6', 70, 0),
  ];

  it('returns all waypoints for "all" tier', () => {
    expect(filterWaypointsByTier(waypoints, 'all')).toHaveLength(8);
  });

  it('returns only major waypoints for "major" tier', () => {
    const result = filterWaypointsByTier(waypoints, 'major');
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Major 1');
    expect(result[1].title).toBe('Major 2');
  });

  it('returns major + every 3rd non-major for "expanded" tier', () => {
    const result = filterWaypointsByTier(waypoints, 'expanded');
    // Major: 2, Non-major every 3rd (indices 0, 3 → Regular 1, Regular 4): 2
    expect(result).toHaveLength(4);
    expect(result.map((w) => w.title)).toEqual([
      'Major 1', 'Regular 1', 'Major 2', 'Regular 4',
    ]);
  });
});

describe('filterWaypointsByRange', () => {
  const waypoints: Waypoint[] = [
    makeWaypoint(1, 0, 'Start', 0, 0),
    makeWaypoint(2, 50, 'Mid', 50, 0),
    makeWaypoint(3, 100, 'Near Future', 100, 0),
    makeWaypoint(4, 500, 'Far Future', 500, 0),
    makeWaypoint(5, 900, 'Very Far', 900, 0),
  ];

  it('includes all unlocked waypoints', () => {
    const result = filterWaypointsByRange(waypoints, 50, 1000, false);
    // Unlocked (≤50): Start, Mid
    // Ahead cutoff: 50 + 1000*0.07 = 120
    // Near Future (100) ≤ 120: included
    // Far Future (500) > 120: excluded
    expect(result.map((w) => w.title)).toEqual(['Start', 'Mid', 'Near Future']);
  });

  it('returns all waypoints in dev mode', () => {
    const result = filterWaypointsByRange(waypoints, 50, 1000, true);
    expect(result).toHaveLength(5);
  });

  it('handles zero user distance', () => {
    const result = filterWaypointsByRange(waypoints, 0, 1000, false);
    // Ahead cutoff: 0 + 70 = 70
    expect(result.map((w) => w.title)).toEqual(['Start', 'Mid']);
  });
});

describe('filterWaypointsByViewport', () => {
  const waypoints: Waypoint[] = [
    makeWaypoint(1, 0, 'Inside', 50, 50),
    makeWaypoint(2, 10, 'Outside Right', 500, 50),
    makeWaypoint(3, 20, 'Outside Bottom', 50, 500),
    makeWaypoint(4, 30, 'Edge Padding', 200, 50), // within padding
  ];

  it('filters to viewport + padding', () => {
    const viewport = { left: 0, top: 0, right: 100, bottom: 100 };
    const result = filterWaypointsByViewport(waypoints, viewport, 100);
    // Inside (50,50): yes
    // Outside Right (500,50): 500 > 200: no
    // Outside Bottom (50,500): 500 > 200: no
    // Edge Padding (200,50): 200 <= 200: yes
    expect(result.map((w) => w.title)).toEqual(['Inside', 'Edge Padding']);
  });

  it('uses default padding of 100', () => {
    const viewport = { left: 0, top: 0, right: 100, bottom: 100 };
    const result = filterWaypointsByViewport(waypoints, viewport);
    expect(result.map((w) => w.title)).toEqual(['Inside', 'Edge Padding']);
  });
});
