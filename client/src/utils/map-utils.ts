/**
 * Map utility functions for journey path rendering.
 *
 * Handles interpolation between sparse anchor points to determine
 * the exact visual cut-off position based on user progress.
 */

import type { PathNode } from '../data/paths/fellowship-path';

export interface Point {
  x: number;
  y: number;
}

export interface PathSplit {
  completedPoints: number[];
  futurePoints: number[];
  /** The exact {x, y} position of the user on the map. */
  userPosition: Point;
}

/**
 * Get the user's current position on the map from their distance.
 * Convenience wrapper around calculateCutoffPoint.
 *
 * @param pathNodes  Ordered path nodes with optional distance anchors.
 * @param userDistance  User's total distance in miles.
 * @returns The {x, y} point on the map, or {x:0, y:0} if path is empty.
 */
export function getUserPosition(
  pathNodes: PathNode[],
  userDistance: number,
): Point {
  return calculateCutoffPoint(pathNodes, userDistance).userPosition;
}

/** Euclidean distance between two points. */
function euclidean(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Flatten a list of Points into a flat [x1,y1,x2,y2,...] array
 * suitable for Konva Line `points` prop.
 */
function flattenPoints(pts: Point[]): number[] {
  const result: number[] = [];
  for (const p of pts) {
    result.push(p.x, p.y);
  }
  return result;
}

/**
 * Linearly interpolate between two points at fraction t ∈ [0,1].
 */
function lerp(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

/**
 * Calculate the split point along the fellowship path based on user distance.
 *
 * Algorithm:
 * 1. Find the bounding anchors (last anchor ≤ userDistance, first anchor > userDistance).
 * 2. Compute segment progress as fraction of distance between anchors.
 * 3. Compute total geometric (pixel) length of all sub-segments between anchors.
 * 4. Walk the sub-segments, consuming (progress × geometricLength) pixels
 *    to find the exact cut-off coordinate.
 * 5. Return two flat arrays: completedPoints and futurePoints.
 *
 * @param pathNodes  Ordered path nodes with optional distance anchors.
 * @param userDistance  User's total distance in miles.
 * @returns Split arrays of flat [x,y,...] coordinates for completed/future lines.
 */
export function calculateCutoffPoint(
  pathNodes: PathNode[],
  userDistance: number,
): PathSplit {
  if (pathNodes.length === 0) {
    return { completedPoints: [], futurePoints: [], userPosition: { x: 0, y: 0 } };
  }

  // Collect anchors (nodes with a defined numeric distance)
  const anchors: { index: number; distance: number }[] = [];
  for (let i = 0; i < pathNodes.length; i++) {
    const d = pathNodes[i].distance;
    if (d !== null && d !== undefined) {
      anchors.push({ index: i, distance: d });
    }
  }

  if (anchors.length === 0) {
    // No anchors — everything is future
    return { completedPoints: [], futurePoints: flattenPoints(pathNodes), userPosition: pathNodes[0] };
  }

  // If user distance is at or past the final anchor, everything is completed
  const lastAnchor = anchors[anchors.length - 1];
  if (userDistance >= lastAnchor.distance) {
    const lastNode = pathNodes[lastAnchor.index];
    return {
      completedPoints: flattenPoints(pathNodes),
      futurePoints: [],
      userPosition: { x: lastNode.x, y: lastNode.y },
    };
  }

  // If user distance is before the first anchor, everything is future
  const firstAnchor = anchors[0];
  if (userDistance <= firstAnchor.distance) {
    const firstNode = pathNodes[firstAnchor.index];
    return {
      completedPoints: [],
      futurePoints: flattenPoints(pathNodes),
      userPosition: { x: firstNode.x, y: firstNode.y },
    };
  }

  // Find bounding anchors
  let startAnchorIdx = 0;
  for (let i = anchors.length - 1; i >= 0; i--) {
    if (anchors[i].distance <= userDistance) {
      startAnchorIdx = i;
      break;
    }
  }
  const endAnchorIdx = startAnchorIdx + 1;

  const startAnchor = anchors[startAnchorIdx];
  const endAnchor = anchors[endAnchorIdx];

  // Progress fraction between the two bounding anchors
  const anchorSpan = endAnchor.distance - startAnchor.distance;
  const segmentProgress = anchorSpan > 0
    ? (userDistance - startAnchor.distance) / anchorSpan
    : 0;

  // Get the sub-path between the two anchor indices
  const subPath = pathNodes.slice(startAnchor.index, endAnchor.index + 1);

  // Compute total geometric length of the sub-path
  let geometricLength = 0;
  for (let i = 1; i < subPath.length; i++) {
    geometricLength += euclidean(subPath[i - 1], subPath[i]);
  }

  // Target pixel distance to walk from startAnchor
  const targetPixelDist = segmentProgress * geometricLength;

  // Walk the sub-segments to find the exact cut-off point
  let accumulated = 0;
  let cutPoint: Point = subPath[0];
  let cutSubIndex = 0; // index within subPath where the cut happens

  for (let i = 1; i < subPath.length; i++) {
    const segLen = euclidean(subPath[i - 1], subPath[i]);
    if (accumulated + segLen >= targetPixelDist) {
      // The cut falls on this segment
      const remaining = targetPixelDist - accumulated;
      const t = segLen > 0 ? remaining / segLen : 0;
      cutPoint = lerp(subPath[i - 1], subPath[i], t);
      cutSubIndex = i;
      break;
    }
    accumulated += segLen;
    cutSubIndex = i;
  }

  // Build completed points: all nodes up to startAnchor + sub-path up to cut
  const completedParts: Point[] = [];
  for (let i = 0; i <= startAnchor.index; i++) {
    completedParts.push(pathNodes[i]);
  }
  // Add sub-path points between start anchor and cut (exclusive of start anchor already added)
  for (let i = 1; i < cutSubIndex; i++) {
    completedParts.push(subPath[i]);
  }
  completedParts.push(cutPoint);

  // Build future points: cut point + remaining sub-path + all nodes after endAnchor
  const futureParts: Point[] = [cutPoint];
  for (let i = cutSubIndex; i < subPath.length; i++) {
    futureParts.push(subPath[i]);
  }
  for (let i = endAnchor.index + 1; i < pathNodes.length; i++) {
    futureParts.push(pathNodes[i]);
  }

  return {
    completedPoints: flattenPoints(completedParts),
    futurePoints: flattenPoints(futureParts),
    userPosition: cutPoint,
  };
}

/**
 * Extract the sub-path between two distances on the journey path.
 * Used for drawing individual member contribution segments that stack
 * end-to-end rather than all starting from 0.
 *
 * @param pathNodes     Ordered path nodes with optional distance anchors.
 * @param startDistance Start distance in miles (segment begins here).
 * @param endDistance   End distance in miles (segment ends here).
 * @returns Flat [x, y, …] array of points for just this segment.
 */
export function calculatePathSegment(
  pathNodes: PathNode[],
  startDistance: number,
  endDistance: number,
): number[] {
  if (endDistance <= startDistance || pathNodes.length === 0) return [];

  const endResult = calculateCutoffPoint(pathNodes, endDistance);

  if (startDistance <= 0) {
    return endResult.completedPoints;
  }

  const startResult = calculateCutoffPoint(pathNodes, startDistance);

  if (startResult.completedPoints.length === 0) {
    return endResult.completedPoints;
  }

  // Skip the shared prefix (all flat coords up to but not including
  // startResult's interpolated cut-point) then prepend the cut-point.
  const skipCount = Math.max(0, startResult.completedPoints.length - 2);
  return [
    startResult.userPosition.x,
    startResult.userPosition.y,
    ...endResult.completedPoints.slice(skipCount),
  ];
}

/**
 * Truncate the future path so it only extends a limited distance
 * beyond the user's current position. This prevents overlapping lines
 * when the path doubles back on itself (e.g. return journeys).
 *
 * @param futurePoints  Flat [x,y,...] array of future path points.
 * @param maxPixelLength  Maximum geometric length (in map pixels) to keep.
 * @returns Truncated flat [x,y,...] array.
 */
export function truncateFuturePath(
  futurePoints: number[],
  maxPixelLength: number,
): number[] {
  if (futurePoints.length < 4) return futurePoints;

  const result: number[] = [futurePoints[0], futurePoints[1]];
  let accumulated = 0;

  for (let i = 2; i < futurePoints.length; i += 2) {
    const prevX = futurePoints[i - 2];
    const prevY = futurePoints[i - 1];
    const curX = futurePoints[i];
    const curY = futurePoints[i + 1];
    const segLen = Math.sqrt((curX - prevX) ** 2 + (curY - prevY) ** 2);

    if (accumulated + segLen >= maxPixelLength) {
      // Interpolate the final point
      const remaining = maxPixelLength - accumulated;
      const t = segLen > 0 ? remaining / segLen : 0;
      result.push(
        prevX + (curX - prevX) * t,
        prevY + (curY - prevY) * t,
      );
      break;
    }
    accumulated += segLen;
    result.push(curX, curY);
  }

  return result;
}

/**
 * Compute the total geometric length of a flat [x,y,...] point array.
 */
export function computePathLength(points: number[]): number {
  let total = 0;
  for (let i = 2; i < points.length; i += 2) {
    const dx = points[i] - points[i - 2];
    const dy = points[i + 1] - points[i - 1];
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Calculate dynamic stroke width that appears consistent across zoom levels.
 *
 * @param baseWidth  Desired visual width in pixels at scale 1.0
 * @param scale      Current zoom scale
 * @param minWidth   Minimum stroke width in map-space pixels
 * @param maxWidth   Maximum stroke width in map-space pixels
 */
export function dynamicStrokeWidth(
  baseWidth: number,
  scale: number,
  minWidth: number = 2,
  maxWidth: number = 10,
): number {
  return clamp(baseWidth / scale, minWidth, maxWidth);
}

/**
 * Calculate a marker scale factor using the same capping logic as
 * `dynamicStrokeWidth`. Each marker type can supply its own base/min/max
 * values so scaling is consistent yet individually tuneable.
 *
 * @param stageScale  Current zoom scale of the stage.
 * @param baseStroke  Reference stroke width used as the 1× baseline (default 6).
 * @param minStroke   Minimum stroke value (default 2).
 * @param maxStroke   Maximum stroke value (default 20).
 * @returns Scale factor to apply to marker groups for zoom independence.
 */
export function markerScale(
  stageScale: number,
  baseStroke: number = 6,
  minStroke: number = 2,
  maxStroke: number = 20,
): number {
  return dynamicStrokeWidth(baseStroke, stageScale, minStroke, maxStroke) / baseStroke;
}

/** Conversion factor from miles to kilometres. */
export const MILES_TO_KM = 1.60934;
