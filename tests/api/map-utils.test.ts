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
  slicePathByPixelDistance,
  computePathLength,
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

describe('slicePathByPixelDistance', () => {
  // Simple straight line: (0,0) -> (100,0) -> (200,0) -> (300,0)
  // Total pixel length = 300
  const straightPath = [0, 0, 100, 0, 200, 0, 300, 0];

  // L-shaped path: (0,0) -> (100,0) -> (100,100)
  // Segment 1 length = 100, segment 2 length = 100, total = 200
  const lPath = [0, 0, 100, 0, 100, 100];

  it('returns empty array when endPx <= startPx', () => {
    expect(slicePathByPixelDistance(straightPath, 50, 50)).toEqual([]);
    expect(slicePathByPixelDistance(straightPath, 100, 50)).toEqual([]);
  });

  it('returns empty array for path with fewer than 4 values', () => {
    expect(slicePathByPixelDistance([0, 0], 0, 100)).toEqual([]);
  });

  it('returns the full path for 0 to total length', () => {
    const result = slicePathByPixelDistance(straightPath, 0, 300);
    expect(result).toHaveLength(8);
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[1]).toBeCloseTo(0, 5);
    expect(result[6]).toBeCloseTo(300, 5);
    expect(result[7]).toBeCloseTo(0, 5);
  });

  it('returns the first half of a straight path', () => {
    const result = slicePathByPixelDistance(straightPath, 0, 150);
    expect(result).toHaveLength(6); // 3 points: (0,0), (100,0), (150,0)
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[1]).toBeCloseTo(0, 5);
    expect(result[2]).toBeCloseTo(100, 5);
    expect(result[3]).toBeCloseTo(0, 5);
    expect(result[4]).toBeCloseTo(150, 5);
    expect(result[5]).toBeCloseTo(0, 5);
  });

  it('returns the second half of a straight path', () => {
    const result = slicePathByPixelDistance(straightPath, 150, 300);
    expect(result).toHaveLength(6); // 3 points: (150,0), (200,0), (300,0)
    expect(result[0]).toBeCloseTo(150, 5);
    expect(result[1]).toBeCloseTo(0, 5);
    expect(result[2]).toBeCloseTo(200, 5);
    expect(result[3]).toBeCloseTo(0, 5);
    expect(result[4]).toBeCloseTo(300, 5);
    expect(result[5]).toBeCloseTo(0, 5);
  });

  it('slices within a single segment', () => {
    const result = slicePathByPixelDistance(straightPath, 25, 75);
    expect(result).toHaveLength(4); // 2 points: (25,0), (75,0)
    expect(result[0]).toBeCloseTo(25, 5);
    expect(result[1]).toBeCloseTo(0, 5);
    expect(result[2]).toBeCloseTo(75, 5);
    expect(result[3]).toBeCloseTo(0, 5);
  });

  it('handles L-shaped path correctly', () => {
    // First half: 0-100 px, covers (0,0) -> (100,0)
    const first = slicePathByPixelDistance(lPath, 0, 100);
    expect(first[0]).toBeCloseTo(0, 5);
    expect(first[1]).toBeCloseTo(0, 5);
    expect(first[first.length - 2]).toBeCloseTo(100, 5);
    expect(first[first.length - 1]).toBeCloseTo(0, 5);

    // Second half: 100-200 px, covers (100,0) -> (100,100)
    const second = slicePathByPixelDistance(lPath, 100, 200);
    expect(second[0]).toBeCloseTo(100, 5);
    expect(second[1]).toBeCloseTo(0, 5);
    expect(second[second.length - 2]).toBeCloseTo(100, 5);
    expect(second[second.length - 1]).toBeCloseTo(100, 5);
  });

  it('adjacent slices connect seamlessly', () => {
    // Split at 150 px — end of first slice should equal start of second
    const first = slicePathByPixelDistance(straightPath, 0, 150);
    const second = slicePathByPixelDistance(straightPath, 150, 300);

    const endOfFirst = [first[first.length - 2], first[first.length - 1]];
    const startOfSecond = [second[0], second[1]];

    expect(endOfFirst[0]).toBeCloseTo(startOfSecond[0], 5);
    expect(endOfFirst[1]).toBeCloseTo(startOfSecond[1], 5);
  });

  it('proportional split of path matches contribution ratios', () => {
    // Simulate a fellowship: Alice 60%, Bob 40%
    const totalLen = computePathLength(straightPath); // 300
    const aliceEnd = 0.6 * totalLen; // 180
    const bobEnd = totalLen;         // 300

    const alice = slicePathByPixelDistance(straightPath, 0, aliceEnd);
    const bob = slicePathByPixelDistance(straightPath, aliceEnd, bobEnd);

    const aliceLen = computePathLength(alice);
    const bobLen = computePathLength(bob);

    expect(aliceLen).toBeCloseTo(180, 1);
    expect(bobLen).toBeCloseTo(120, 1);
    expect(aliceLen / totalLen).toBeCloseTo(0.6, 2);
    expect(bobLen / totalLen).toBeCloseTo(0.4, 2);
  });
});
