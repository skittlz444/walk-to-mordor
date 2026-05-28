/**
 * JourneyPath – renders the Fellowship path on the Konva map layer.
 *
 * Uses Konva's imperative API (react-konva is incompatible with preact/compat).
 * Two main Line shapes are drawn:
 *   1. Future path  – dashed line showing next 7% of journey ahead
 *   2. Completed path – solid dark red line showing walked distance
 *
 * The future tail from 7% to 11% is rendered as additional short dashed
 * segments with decreasing opacity to create a smooth fade-out.
 *
 * Both lines use `listening: false` for performance (no hit detection needed).
 * Stroke width scales inversely with zoom so the line looks consistent.
 *
 * Dev mode (window.__MAP_DEV_LOG = true):
 *   - Shows the entire future path (not truncated)
 *   - Renders future path as a solid line instead of dashed
 */

import Konva from 'konva';
import { type PathNode } from '../../data/paths/fellowship-path';
import { getPathByKey } from '../../data/paths/registry';
import {
  calculateCutoffPoint,
  truncateFuturePath,
  dynamicStrokeWidth,
} from '../../utils/map-utils';

declare global {
  interface Window {
    __MAP_DEV_LOG?: boolean;
  }
}

const BASE_STROKE = 6;
const MIN_STROKE = 2;
const MAX_STROKE = 10;

/** Solid future path distance (7% of total path length). */
const FUTURE_SOLID_FRACTION = 0.07;
/** End distance for faded future tail (11% of total path length). */
const FUTURE_FADE_END_FRACTION = 0.11;
/** Number of segments used to approximate the fade-out from 7% to 11%. */
const FUTURE_FADE_SEGMENTS = 8;

// Visual styles
const FUTURE_COLOR = '#6B4226';      // warm brown, more visible
const FUTURE_OPACITY = 0.85;
const FUTURE_DASH = [12, 8];         // dash pattern (in map-space pixels)
const COMPLETED_COLOR = '#8B1A1A';   // dark red
const COMPLETED_OPACITY = 1.0;
const LINE_CAP: CanvasLineCap = 'round';
const LINE_JOIN: CanvasLineJoin = 'round';

export interface JourneyPathNodes {
  completedLine: Konva.Line;
  futureLine: Konva.Line;
  futureFadeLines: Konva.Line[];
}

/**
 * Slice a flat [x,y,...] polyline by cumulative distance from its start.
 * Returns the sub-path between startPx and endPx (inclusive endpoints).
 */
function slicePathByDistance(points: number[], startPx: number, endPx: number): number[] {
  if (points.length < 4 || endPx <= startPx) return [];

  const result: number[] = [];
  let accumulated = 0;

  for (let i = 2; i < points.length; i += 2) {
    const x0 = points[i - 2];
    const y0 = points[i - 1];
    const x1 = points[i];
    const y1 = points[i + 1];
    const segLen = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);

    if (segLen <= 0) {
      continue;
    }

    const segStart = accumulated;
    const segEnd = accumulated + segLen;

    const overlapStart = Math.max(startPx, segStart);
    const overlapEnd = Math.min(endPx, segEnd);

    if (overlapEnd > overlapStart) {
      const t0 = (overlapStart - segStart) / segLen;
      const t1 = (overlapEnd - segStart) / segLen;

      const sx = x0 + (x1 - x0) * t0;
      const sy = y0 + (y1 - y0) * t0;
      const ex = x0 + (x1 - x0) * t1;
      const ey = y0 + (y1 - y0) * t1;

      if (result.length === 0) {
        result.push(sx, sy);
      }
      result.push(ex, ey);
    }

    accumulated = segEnd;
    if (accumulated >= endPx) {
      break;
    }
  }

  return result;
}

/** Build fade segments between the 7% and 11% future path distances. */
function buildFadeSegments(futurePoints: number[], fullPathPixelLength: number): number[][] {
  const fadeStartPx = fullPathPixelLength * FUTURE_SOLID_FRACTION;
  const fadeEndPx = fullPathPixelLength * FUTURE_FADE_END_FRACTION;
  const segmentSize = (fadeEndPx - fadeStartPx) / FUTURE_FADE_SEGMENTS;

  const segments: number[][] = [];
  for (let i = 0; i < FUTURE_FADE_SEGMENTS; i++) {
    const segStart = fadeStartPx + segmentSize * i;
    const segEnd = segStart + segmentSize;
    segments.push(slicePathByDistance(futurePoints, segStart, segEnd));
  }
  return segments;
}

/** Pre-compute the total geometric pixel length of the full path.
 *  Results are cached per path array reference to avoid O(n) on every render.
 */
const pathPixelLengthCache = new Map<PathNode[], number>();

function getFullPathPixelLength(path: PathNode[]): number {
  const cached = pathPixelLengthCache.get(path);
  if (cached !== undefined) return cached;

  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  pathPixelLengthCache.set(path, total);
  return total;
}

/**
 * Create the two Konva Line nodes for the journey path.
 *
 * @param layer   The Konva layer to add lines to.
 * @param userDistance  User's total walked distance in miles.
 * @param scale   Current zoom scale (used for stroke width).
 * @returns References to both line nodes for later updates.
 */
export function createJourneyPath(
  layer: Konva.Layer,
  userDistance: number,
  scale: number,
  path: PathNode[] = getPathByKey(null),
): JourneyPathNodes {
  const { completedPoints, futurePoints } = calculateCutoffPoint(
    path,
    userDistance,
  );

  // In dev mode, show entire path as solid; otherwise use 7% + 7-11% fade tail
  const devMode = !!window.__MAP_DEV_LOG;
  const fullPathPixelLength = getFullPathPixelLength(path);
  const solidFuturePixels = fullPathPixelLength * FUTURE_SOLID_FRACTION;
  const displayedFuture = devMode ? futurePoints : truncateFuturePath(futurePoints, solidFuturePixels);
  const fadeSegments = devMode ? [] : buildFadeSegments(futurePoints, fullPathPixelLength);

  const strokeWidth = dynamicStrokeWidth(BASE_STROKE, scale, MIN_STROKE, MAX_STROKE);
  const scaledDash = FUTURE_DASH.map((d) => d / scale);

  const futureLine = new Konva.Line({
    points: displayedFuture,
    stroke: FUTURE_COLOR,
    strokeWidth,
    opacity: FUTURE_OPACITY,
    dash: devMode ? [] : scaledDash,
    lineCap: LINE_CAP,
    lineJoin: LINE_JOIN,
    listening: false,
    tension: 0.25,
  });

  const futureFadeLines = fadeSegments.map((segmentPoints, index) => {
    const opacity = FUTURE_OPACITY * (1 - index / FUTURE_FADE_SEGMENTS);
    return new Konva.Line({
      points: segmentPoints,
      stroke: FUTURE_COLOR,
      strokeWidth,
      opacity,
      dash: scaledDash,
      lineCap: LINE_CAP,
      lineJoin: LINE_JOIN,
      listening: false,
      tension: 0.25,
    });
  });

  const completedLine = new Konva.Line({
    points: completedPoints,
    stroke: COMPLETED_COLOR,
    strokeWidth,
    opacity: COMPLETED_OPACITY,
    lineCap: LINE_CAP,
    lineJoin: LINE_JOIN,
    listening: false,
    tension: 0.25,
  });

  // Future line goes first (underneath), completed line on top
  layer.add(futureLine);
  for (const fadeLine of futureFadeLines) {
    layer.add(fadeLine);
  }
  layer.add(completedLine);

  return { completedLine, futureLine, futureFadeLines };
}

/**
 * Update the journey path lines when zoom or distance changes.
 *
 * @param nodes   References to the Konva line nodes.
 * @param userDistance  User's current distance in miles.
 * @param scale   Current zoom scale.
 */
export function updateJourneyPath(
  nodes: JourneyPathNodes,
  userDistance: number,
  scale: number,
  path: PathNode[] = getPathByKey(null),
): void {
  const { completedPoints, futurePoints } = calculateCutoffPoint(
    path,
    userDistance,
  );

  // In dev mode, show entire path as solid; otherwise use 7% + 7-11% fade tail
  const devMode = !!window.__MAP_DEV_LOG;
  const fullPathPixelLength = getFullPathPixelLength(path);
  const solidFuturePixels = fullPathPixelLength * FUTURE_SOLID_FRACTION;
  const displayedFuture = devMode ? futurePoints : truncateFuturePath(futurePoints, solidFuturePixels);
  const fadeSegments = devMode ? [] : buildFadeSegments(futurePoints, fullPathPixelLength);

  const strokeWidth = dynamicStrokeWidth(BASE_STROKE, scale, MIN_STROKE, MAX_STROKE);

  nodes.futureLine.points(displayedFuture);
  nodes.futureLine.strokeWidth(strokeWidth);
  // Dev mode: solid line; normal mode: scaled dash pattern
  nodes.futureLine.dash(devMode ? [] : FUTURE_DASH.map((d) => d / scale));
  nodes.futureLine.opacity(devMode ? 1.0 : FUTURE_OPACITY);
  nodes.futureLine.stroke(devMode ? '#ff0000' : FUTURE_COLOR); // bright red in dev mode

  for (let i = 0; i < nodes.futureFadeLines.length; i++) {
    const fadeLine = nodes.futureFadeLines[i];
    const segmentPoints = fadeSegments[i] ?? [];
    const opacity = FUTURE_OPACITY * (1 - i / FUTURE_FADE_SEGMENTS);

    fadeLine.points(segmentPoints);
    fadeLine.strokeWidth(strokeWidth);
    fadeLine.dash(devMode ? [] : FUTURE_DASH.map((d) => d / scale));
    fadeLine.opacity(devMode ? 0 : opacity);
    fadeLine.stroke(devMode ? '#ff0000' : FUTURE_COLOR);
  }

  nodes.completedLine.points(completedPoints);
  nodes.completedLine.strokeWidth(strokeWidth);
}
