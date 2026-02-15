/**
 * WaypointMarkers – renders goal milestone markers on the Konva map.
 *
 * Uses Konva's imperative API (react-konva is incompatible with preact/compat).
 * Markers are rendered as circles with inverse scaling for zoom independence.
 *
 * Visual states:
 *   - Unlocked: gold fill, white stroke, interactive.
 *   - Next:     gold fill with glow effect (only one marker).
 *   - Locked:   gray fill, reduced opacity, non-interactive.
 *   - Special:  diamond shape instead of circle to distinguish narrative milestones.
 */

import Konva from 'konva';
import type { Waypoint } from '../../data/waypoints';
import { dynamicStrokeWidth } from '../../utils/map-utils';

/** Marker visual size in screen pixels (matches UserMarker MARKER_SIZE). */
const MARKER_SIZE = 32;
const MARKER_HALF = MARKER_SIZE / 2;

// Colors
const UNLOCKED_FILL = '#FFD700';        // Gold
const UNLOCKED_STROKE = '#FFFFFF';      // White
const NEXT_GLOW_COLOR = '#FFD700';      // Gold glow
const NEXT_GLOW_BLUR = 12;
const LOCKED_FILL = '#666666';          // Gray
const LOCKED_OPACITY = 0.4;
const SPECIAL_FILL = '#DAA520';         // Goldenrod (slightly different for special)
const SPECIAL_STROKE = '#8B6914';       // Darker gold stroke for special

/**
 * Calculate the marker scale factor using the same capping logic as UserMarker
 * so waypoint markers match the user icon size.
 */
function markerScale(stageScale: number): number {
  const baseStroke = 6;
  const minStroke = 2;
  const maxStroke = 20;
  const effectiveStroke = dynamicStrokeWidth(baseStroke, stageScale, minStroke, maxStroke);
  return effectiveStroke / baseStroke;
}

export interface WaypointMarkerNodes {
  group: Konva.Group;
  /** Update inverse scale for all markers for zoom independence. */
  setScale: (stageScale: number) => void;
  /** Rebuild markers with updated filter/visibility. */
  update: (
    waypoints: Waypoint[],
    userDistance: number,
    stageScale: number,
  ) => void;
  /** Destroy all markers and clean up. */
  destroy: () => void;
}

/**
 * Create a diamond (rotated square) shape for special waypoints.
 */
function createDiamondShape(
  fill: string,
  stroke: string,
  strokeWidth: number,
  opacity: number,
  shadowBlur: number,
  shadowColor: string,
): Konva.RegularPolygon {
  return new Konva.RegularPolygon({
    x: 0,
    y: 0,
    sides: 4,
    radius: MARKER_HALF - 4,
    rotation: 0,
    fill,
    stroke,
    strokeWidth,
    opacity,
    shadowBlur,
    shadowColor,
    shadowOpacity: shadowBlur > 0 ? 0.6 : 0,
  });
}

/**
 * Create a circle shape for regular (non-special) waypoints.
 */
function createCircleShape(
  fill: string,
  stroke: string,
  strokeWidth: number,
  opacity: number,
  shadowBlur: number,
  shadowColor: string,
): Konva.Circle {
  return new Konva.Circle({
    x: 0,
    y: 0,
    radius: MARKER_HALF - 6,
    fill,
    stroke,
    strokeWidth,
    opacity,
    shadowBlur,
    shadowColor,
    shadowOpacity: shadowBlur > 0 ? 0.6 : 0,
  });
}

/**
 * Create waypoint markers on a Konva layer.
 *
 * @param layer         The Konva layer to add markers to.
 * @param waypoints     Filtered waypoints to render.
 * @param userDistance   User's current distance in miles.
 * @param stageScale    Current zoom scale.
 * @param onSelect      Callback when an unlocked waypoint is clicked.
 * @returns WaypointMarkerNodes with references and control methods.
 */
export function createWaypointMarkers(
  layer: Konva.Layer,
  waypoints: Waypoint[],
  userDistance: number,
  stageScale: number,
  onSelect?: (wp: Waypoint) => void,
): WaypointMarkerNodes {
  const group = new Konva.Group();
  layer.add(group);

  const markerGroups: Konva.Group[] = [];

  function buildMarkers(
    wps: Waypoint[],
    uDist: number,
    scale: number,
  ): void {
    // Clear existing markers
    for (const mg of markerGroups) {
      mg.destroy();
    }
    markerGroups.length = 0;

    const s = markerScale(scale);

    // Find the "next" waypoint (first where distance > userDistance)
    let nextWaypointId: number | null = null;
    for (const wp of wps) {
      if (wp.distance > uDist) {
        nextWaypointId = wp.id;
        break;
      }
    }

    for (const wp of wps) {
      const isUnlocked = wp.distance <= uDist;
      const isNext = wp.id === nextWaypointId;
      const isSpecial = wp.special !== null && wp.special !== undefined && wp.special !== '';

      const mg = new Konva.Group({
        x: wp.x,
        y: wp.y,
        scaleX: s,
        scaleY: s,
      });

      // Determine visual properties
      let fill: string;
      let stroke: string;
      let strokeWidth: number;
      let opacity: number;
      let shadowBlur: number;
      let shadowColor: string;

      if (isUnlocked || isNext) {
        fill = isSpecial ? SPECIAL_FILL : UNLOCKED_FILL;
        stroke = isSpecial ? SPECIAL_STROKE : UNLOCKED_STROKE;
        strokeWidth = isSpecial ? 3 : 2;
        opacity = 1.0;
        shadowBlur = isNext ? NEXT_GLOW_BLUR : 0;
        shadowColor = isNext ? NEXT_GLOW_COLOR : '';
      } else {
        // Locked
        fill = LOCKED_FILL;
        stroke = '#999999';
        strokeWidth = 1;
        opacity = LOCKED_OPACITY;
        shadowBlur = 0;
        shadowColor = '';
      }

      // Use diamond for special waypoints, circle for regular
      if (isSpecial) {
        mg.add(createDiamondShape(fill, stroke, strokeWidth, opacity, shadowBlur, shadowColor));
      } else {
        mg.add(createCircleShape(fill, stroke, strokeWidth, opacity, shadowBlur, shadowColor));
      }

      // Interactivity for unlocked/next waypoints
      if (isUnlocked || isNext) {
        mg.listening(true);
        mg.on('mouseenter', () => {
          const stage = layer.getStage();
          if (stage) {
            const container = stage.container();
            container.style.cursor = 'pointer';
          }
        });
        mg.on('mouseleave', () => {
          const stage = layer.getStage();
          if (stage) {
            const container = stage.container();
            container.style.cursor = 'grab';
          }
        });
        mg.on('click tap', () => {
          console.log('[WaypointMarker] Selected:', wp.title, wp);
          if (onSelect) onSelect(wp);
        });
      } else {
        // Locked: no event handling for performance
        mg.listening(false);
      }

      group.add(mg);
      markerGroups.push(mg);
    }

    layer.batchDraw();
  }

  // Initial build
  buildMarkers(waypoints, userDistance, stageScale);

  return {
    group,

    setScale(stageScale: number) {
      const s = markerScale(stageScale);
      for (const mg of markerGroups) {
        mg.scaleX(s);
        mg.scaleY(s);
      }
    },

    update(wps: Waypoint[], uDist: number, scale: number) {
      buildMarkers(wps, uDist, scale);
    },

    destroy() {
      for (const mg of markerGroups) {
        mg.destroy();
      }
      markerGroups.length = 0;
      group.destroy();
    },
  };
}
