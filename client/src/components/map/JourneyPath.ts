/**
 * JourneyPath – renders the Fellowship path on the Konva map layer.
 *
 * Uses Konva's imperative API (react-konva is incompatible with preact/compat).
 * Two Line shapes are drawn:
 *   1. Future path  – faint dashed line (sepia/dark grey, 0.5 opacity)
 *   2. Completed path – solid line (gold-red, 1.0 opacity)
 *
 * Both lines use `listening: false` for performance (no hit detection needed).
 * Stroke width scales inversely with zoom so the line looks consistent.
 */

import Konva from 'konva';
import { fellowshipPath } from '../../data/paths/fellowship-path';
import { calculateCutoffPoint, dynamicStrokeWidth } from '../../utils/map-utils';

const BASE_STROKE = 6;
const MIN_STROKE = 2;
const MAX_STROKE = 10;

// Visual styles
const FUTURE_COLOR = '#5C4033';      // dark sepia brown
const FUTURE_OPACITY = 0.5;
const FUTURE_DASH = [12, 8];         // dash pattern (in map-space pixels)
const COMPLETED_COLOR = '#C8A43C';   // gold
const COMPLETED_OPACITY = 1.0;
const LINE_CAP: CanvasLineCap = 'round';
const LINE_JOIN: CanvasLineJoin = 'round';

export interface JourneyPathNodes {
  completedLine: Konva.Line;
  futureLine: Konva.Line;
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
): JourneyPathNodes {
  const { completedPoints, futurePoints } = calculateCutoffPoint(
    fellowshipPath,
    userDistance,
  );

  const strokeWidth = dynamicStrokeWidth(BASE_STROKE, scale, MIN_STROKE, MAX_STROKE);

  const futureLine = new Konva.Line({
    points: futurePoints,
    stroke: FUTURE_COLOR,
    strokeWidth,
    opacity: FUTURE_OPACITY,
    dash: FUTURE_DASH,
    lineCap: LINE_CAP,
    lineJoin: LINE_JOIN,
    listening: false,
    tension: 0.3,
  });

  const completedLine = new Konva.Line({
    points: completedPoints,
    stroke: COMPLETED_COLOR,
    strokeWidth,
    opacity: COMPLETED_OPACITY,
    lineCap: LINE_CAP,
    lineJoin: LINE_JOIN,
    listening: false,
    tension: 0.3,
  });

  // Future line goes first (underneath), completed line on top
  layer.add(futureLine);
  layer.add(completedLine);

  return { completedLine, futureLine };
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
): void {
  const { completedPoints, futurePoints } = calculateCutoffPoint(
    fellowshipPath,
    userDistance,
  );

  const strokeWidth = dynamicStrokeWidth(BASE_STROKE, scale, MIN_STROKE, MAX_STROKE);

  nodes.futureLine.points(futurePoints);
  nodes.futureLine.strokeWidth(strokeWidth);
  // Scale dash pattern inversely with zoom for visual consistency
  nodes.futureLine.dash(FUTURE_DASH.map((d) => d / scale));

  nodes.completedLine.points(completedPoints);
  nodes.completedLine.strokeWidth(strokeWidth);
}
