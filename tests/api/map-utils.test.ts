/**
 * Tests for calculatePathSegment utility.
 *
 * calculatePathSegment extracts the sub-path between two distances,
 * enabling member contribution segments to stack end-to-end on the map.
 */

// Use relative import since client/ has its own tsconfig
import {
  calculatePathSegment,
  calculateCutoffPoint,
  getUserPosition,
} from '../../client/src/utils/map-utils';

interface PathNode {
  x: number;
  y: number;
  distance: number | null;
}

// Simple linear path: 5 anchor nodes at distances 0, 100, 200, 300, 400
const linearPath: PathNode[] = [
  { x: 0, y: 0, distance: 0 },
  { x: 100, y: 0, distance: 100 },
  { x: 200, y: 0, distance: 200 },
  { x: 300, y: 0, distance: 300 },
  { x: 400, y: 0, distance: 400 },
];

// Path with geometry-only nodes (distance: null)
const pathWithGeo: PathNode[] = [
  { x: 0, y: 0, distance: 0 },
  { x: 50, y: 10, distance: null }, // geometry-only
  { x: 100, y: 0, distance: 100 },
  { x: 150, y: 10, distance: null }, // geometry-only
  { x: 200, y: 0, distance: 200 },
];

describe('calculatePathSegment', () => {
  it('returns empty array when endDistance <= startDistance', () => {
    expect(calculatePathSegment(linearPath, 100, 100)).toEqual([]);
    expect(calculatePathSegment(linearPath, 200, 100)).toEqual([]);
  });

  it('returns empty array for empty path', () => {
    expect(calculatePathSegment([], 0, 100)).toEqual([]);
  });

  it('returns full completed path when startDistance is 0', () => {
    const result = calculatePathSegment(linearPath, 0, 200);
    const cutoff = calculateCutoffPoint(linearPath, 200);
    expect(result).toEqual(cutoff.completedPoints);
  });

  it('extracts a mid-path segment between two distances', () => {
    // Segment from distance 100 to 200 should cover x=100 to x=200
    const segment = calculatePathSegment(linearPath, 100, 200);
    expect(segment.length).toBeGreaterThanOrEqual(4); // at least 2 points

    // First point should be at ~(100, 0)
    expect(segment[0]).toBeCloseTo(100, 0);
    expect(segment[1]).toBeCloseTo(0, 0);

    // Last point should be at ~(200, 0)
    expect(segment[segment.length - 2]).toBeCloseTo(200, 0);
    expect(segment[segment.length - 1]).toBeCloseTo(0, 0);
  });

  it('segments stack end-to-end without gaps or overlaps', () => {
    // Simulate 3 members: 0→150, 150→250, 250→350
    const seg1 = calculatePathSegment(linearPath, 0, 150);
    const seg2 = calculatePathSegment(linearPath, 150, 250);
    const seg3 = calculatePathSegment(linearPath, 250, 350);

    // End of seg1 should match start of seg2
    const seg1End = [seg1[seg1.length - 2], seg1[seg1.length - 1]];
    const seg2Start = [seg2[0], seg2[1]];
    expect(seg1End[0]).toBeCloseTo(seg2Start[0], 1);
    expect(seg1End[1]).toBeCloseTo(seg2Start[1], 1);

    // End of seg2 should match start of seg3
    const seg2End = [seg2[seg2.length - 2], seg2[seg2.length - 1]];
    const seg3Start = [seg3[0], seg3[1]];
    expect(seg2End[0]).toBeCloseTo(seg3Start[0], 1);
    expect(seg2End[1]).toBeCloseTo(seg3Start[1], 1);
  });

  it('handles segments that span geometry-only nodes', () => {
    // Segment from 0 to 100 should include the geometry-only node at (50,10)
    const segment = calculatePathSegment(pathWithGeo, 0, 100);
    expect(segment.length).toBeGreaterThanOrEqual(6); // at least 3 points

    // Should contain the geometry node coordinates
    const hasGeoNode = segment.some(
      (val, i) => i % 2 === 0 && val === 50 && segment[i + 1] === 10,
    );
    expect(hasGeoNode).toBe(true);
  });

  it('handles segment starting beyond all anchors', () => {
    // Start past the last anchor — returns a degenerate segment at the end point
    const segment = calculatePathSegment(linearPath, 500, 600);
    // Both start and end resolve to the last anchor, producing a zero-length segment
    expect(segment.length).toBeLessThanOrEqual(4);
  });

  it('handles segment ending beyond last anchor', () => {
    // Segment from 300 to 500 (past the end at 400)
    const segment = calculatePathSegment(linearPath, 300, 500);
    expect(segment.length).toBeGreaterThanOrEqual(4);

    // Last point should be at the end of the path (400, 0)
    expect(segment[segment.length - 2]).toBeCloseTo(400, 0);
    expect(segment[segment.length - 1]).toBeCloseTo(0, 0);
  });

  it('produces non-zero-length segments for small contributions', () => {
    // A very small segment: 98 to 102
    const segment = calculatePathSegment(linearPath, 98, 102);
    expect(segment.length).toBeGreaterThanOrEqual(4);

    // First point x should be near 98, last near 102
    expect(segment[0]).toBeCloseTo(98, 0);
    expect(segment[segment.length - 2]).toBeCloseTo(102, 0);
  });
});

describe('getUserPosition', () => {
  it('returns position at distance 0', () => {
    const pos = getUserPosition(linearPath, 0);
    expect(pos.x).toBeCloseTo(0, 0);
    expect(pos.y).toBeCloseTo(0, 0);
  });

  it('returns interpolated position mid-segment', () => {
    const pos = getUserPosition(linearPath, 150);
    expect(pos.x).toBeCloseTo(150, 0);
    expect(pos.y).toBeCloseTo(0, 0);
  });

  it('returns end position when past final anchor', () => {
    const pos = getUserPosition(linearPath, 500);
    expect(pos.x).toBeCloseTo(400, 0);
    expect(pos.y).toBeCloseTo(0, 0);
  });
});
