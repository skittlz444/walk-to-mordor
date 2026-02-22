/**
 * WaypointMarkers - renders goal milestone markers on the Konva map.
 *
 * Uses Konva's imperative API (react-konva is incompatible with preact/compat).
 * Markers are rendered as circles with inverse scaling for zoom independence.
 *
 * Visual states:
 *   - Unlocked: gold fill, white stroke, interactive.
 *   - Next:     locked coloring with visible glow ring to highlight destination.
 *   - Locked:   gray fill, reduced opacity, non-interactive.
 *   - Special:  diamond shape instead of circle to distinguish narrative milestones.
 *
 * Clustering:
 *   - When multiple waypoints overlap at screen level, they are grouped into
 *     a single cluster marker showing the count as a numbered badge.
 */

import Konva from 'konva';
import type { Waypoint } from '../../data/waypoints';
import { markerScale } from '../../utils/map-utils';
import { showFutureGoalsUnlocked } from '../../stores/mapStore';

/** Marker visual size in screen pixels (matches UserMarker MARKER_SIZE). */
const MARKER_SIZE = 32;
const MARKER_HALF = MARKER_SIZE / 2;

// Colors
const UNLOCKED_FILL = '#FFD700';        // Gold
const UNLOCKED_STROKE = '#FFFFFF';      // White
const NEXT_GLOW_COLOR = '#ff8800';      // Amber glow (more visible than gold-on-gold)
const NEXT_GLOW_BLUR = 20;             // Increased blur for visibility
const NEXT_GLOW_OPACITY = 0.8;           // Opacity for next waypoint glow
const NEXT_GLOW_STROKE = '#bb8f00';
const LOCKED_FILL = '#666666';          // Gray
const LOCKED_OPACITY = 0.6;
const SPECIAL_FILL = '#DAA520';         // Goldenrod (slightly different for special)
const SPECIAL_STROKE = '#8B6914';       // Darker gold stroke for special
const CLUSTER_FILL = '#FFD700';         // Gold cluster circle
const CLUSTER_STROKE = '#FFFFFF';       // White stroke on cluster
const CLUSTER_TEXT_COLOR = '#000000';   // Black text for badge count

/** Distance (in map pixels) below which waypoints are clustered together. */
const CLUSTER_RADIUS = 30;

/**
 * Calculate the marker scale factor for waypoint markers.
 * Delegates to the shared `markerScale` utility with waypoint-specific
 * settings (base=6, min=2, max=20).
 */
function waypointMarkerScale(stageScale: number): number {
  return markerScale(stageScale, 6, 2, 20);
}

export interface WaypointMarkerNodes {
  group: Konva.Group;
  /** Rebuild markers with updated filter/visibility. */
  update: (
    waypoints: Waypoint[],
    userDistance: number,
    stageScale: number,
    nextWaypointId: number | null,
  ) => void;
  /**
   * Incrementally update visible markers during pan.
   * Only adds/removes markers that enter or leave the viewport,
   * avoiding a full rebuild on every drag frame.
   */
  patchViewport: (
    waypoints: Waypoint[],
    userDistance: number,
    stageScale: number,
    nextWaypointId: number | null,
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
    shadowOpacity: shadowBlur > 0 ? 0.8 : 0,
    shadowEnabled: shadowBlur > 0,
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
    shadowOpacity: shadowBlur > 0 ? 0.8 : 0,
    shadowEnabled: shadowBlur > 0,
  });
}

/** A cluster of overlapping waypoints or a single waypoint. */
interface WaypointCluster {
  /** Representative x position (average). */
  x: number;
  /** Representative y position (average). */
  y: number;
  /** Waypoints in this cluster. */
  items: Waypoint[];
}

/**
 * Group waypoints that are too close together (in map-pixel space)
 * into clusters, accounting for current scale.
 */
function clusterWaypoints(waypoints: Waypoint[], scale: number): WaypointCluster[] {
  const clusterDist = CLUSTER_RADIUS / scale; // map-space distance threshold
  const used = new Set<number>();
  const clusters: WaypointCluster[] = [];

  for (let i = 0; i < waypoints.length; i++) {
    if (used.has(i)) continue;
    const wp = waypoints[i];
    const items: Waypoint[] = [wp];
    used.add(i);

    for (let j = i + 1; j < waypoints.length; j++) {
      if (used.has(j)) continue;
      const other = waypoints[j];
      const dx = wp.x - other.x;
      const dy = wp.y - other.y;
      if (Math.sqrt(dx * dx + dy * dy) < clusterDist) {
        items.push(other);
        used.add(j);
      }
    }

    // Cluster position = average of members
    let cx = 0;
    let cy = 0;
    for (const item of items) {
      cx += item.x;
      cy += item.y;
    }
    clusters.push({ x: cx / items.length, y: cy / items.length, items });
  }

  return clusters;
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
  onSelect?: (wp: Waypoint, cluster?: Waypoint[]) => void,
): WaypointMarkerNodes {
  const group = new Konva.Group();
  layer.add(group);

  const markerGroups: Konva.Group[] = [];

  function buildMarkers(
    wps: Waypoint[],
    uDist: number,
    scale: number,
    nextId: number | null,
  ): void {
    // Clear existing markers
    for (const mg of markerGroups) {
      mg.destroy();
    }
    markerGroups.length = 0;

    const s = waypointMarkerScale(scale);

    // Cluster overlapping waypoints
    const clusters = clusterWaypoints(wps, scale);

    for (const cluster of clusters) {
      if (cluster.items.length === 1) {
        // Single waypoint - render normally
        const wp = cluster.items[0];
        const isUnlocked = wp.distance <= uDist;
        const isNext = wp.id === nextId;
        const isSpecial = wp.special !== null && wp.special !== undefined && wp.special !== '';

        // When preference is ON, treat ALL future waypoints (including next) as unlocked
        const showAsUnlocked = isUnlocked || showFutureGoalsUnlocked.value;

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

        if (showAsUnlocked) {
          fill = isSpecial ? SPECIAL_FILL : UNLOCKED_FILL;
          stroke = isSpecial ? SPECIAL_STROKE : UNLOCKED_STROKE;
          strokeWidth = isSpecial ? 3 : 2;
          opacity = 1.0;
          shadowBlur = 0;
          shadowColor = '';
        } else if (isNext) {
          // Next waypoint: locked coloring but with glow effect
          fill = LOCKED_FILL;
          stroke = NEXT_GLOW_STROKE;
          strokeWidth = 2;
          opacity = NEXT_GLOW_OPACITY;
          shadowBlur = NEXT_GLOW_BLUR;
          shadowColor = NEXT_GLOW_COLOR;
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

        // Interactivity for unlocked or preference-visible waypoints only
        if (showAsUnlocked) {
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
            if (window.__MAP_DEV_LOG) console.log('[WaypointMarker] Selected:', wp.title, wp);
            if (onSelect) onSelect(wp);
          });
        } else {
          // Locked: no event handling for performance
          mg.listening(false);
        }

        group.add(mg);
        markerGroups.push(mg);
      } else {
        // Multiple waypoints clustered - render cluster badge
        const mg = new Konva.Group({
          x: cluster.x,
          y: cluster.y,
          scaleX: s,
          scaleY: s,
        });

        // Determine if any item in the cluster is unlocked
        // When preference is ON, all waypoints are unlocked
        const hasUnlocked = showFutureGoalsUnlocked.value || cluster.items.some((w) => w.distance <= uDist);
        const clusterOpacity = hasUnlocked ? 1.0 : LOCKED_OPACITY;
        const clusterFillColor = hasUnlocked ? CLUSTER_FILL : LOCKED_FILL;

        // Cluster circle (slightly larger than single markers)
        const clusterRadius = MARKER_HALF - 2;
        mg.add(new Konva.Circle({
          x: 0,
          y: 0,
          radius: clusterRadius,
          fill: clusterFillColor,
          stroke: CLUSTER_STROKE,
          strokeWidth: 2,
          opacity: clusterOpacity,
        }));

        // Count badge text
        mg.add(new Konva.Text({
          text: String(cluster.items.length),
          x: -clusterRadius,
          y: -clusterRadius * 0.45,
          width: clusterRadius * 2,
          align: 'center',
          fontSize: 12,
          fontStyle: 'bold',
          fill: CLUSTER_TEXT_COLOR,
          listening: false,
        }));

        // Cluster is interactive if it has unlocked items
        if (hasUnlocked) {
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
            // Select the first unlocked item in the cluster, but pass the full cluster list
            const target = cluster.items.find((w) => w.distance <= uDist) ?? cluster.items[0];
            if (window.__MAP_DEV_LOG) console.log('[WaypointMarker] Cluster selected:', cluster.items.length, 'items, picked:', target.title);
            if (onSelect) onSelect(target, cluster.items);
          });
        } else {
          mg.listening(false);
        }

        group.add(mg);
        markerGroups.push(mg);
      }
    }

    layer.batchDraw();
  }

  // Initial build (no next waypoint ID provided on init with empty array)
  buildMarkers(waypoints, userDistance, stageScale, null);

  /** Set of waypoint IDs (or cluster keys) currently rendered, for incremental patching. */
  let renderedKeys = new Set<string>();

  /** Build a stable key for a set of waypoints (single or cluster). */
  function makeKey(wps: Waypoint[]): string {
    return wps.map((w) => w.id).sort((a, b) => a - b).join(',');
  }

  /** Snapshot current rendered keys after a full build. */
  function snapshotKeys(clusters: WaypointCluster[]): Set<string> {
    const keys = new Set<string>();
    for (const c of clusters) {
      keys.add(makeKey(c.items));
    }
    return keys;
  }

  return {
    group,

    update(wps: Waypoint[], uDist: number, scale: number, nextId: number | null) {
      buildMarkers(wps, uDist, scale, nextId);
      // Snapshot rendered state for future patchViewport calls
      renderedKeys = snapshotKeys(clusterWaypoints(wps, scale));
    },

    patchViewport(wps: Waypoint[], uDist: number, scale: number, nextId: number | null) {
      // Build the candidate set of clusters for the new viewport
      const clusters = clusterWaypoints(wps, scale);
      const newKeys = snapshotKeys(clusters);

      // Compare: if the set of rendered keys is the same, do nothing
      if (
        newKeys.size === renderedKeys.size &&
        [...newKeys].every((k) => renderedKeys.has(k))
      ) {
        return; // viewport hasn't changed the visible set — skip rebuild
      }

      // The visible set changed — do a full rebuild (simple & correct)
      buildMarkers(wps, uDist, scale, nextId);
      renderedKeys = newKeys;
    },

    destroy() {
      for (const mg of markerGroups) {
        mg.destroy();
      }
      markerGroups.length = 0;
      group.destroy();
      renderedKeys.clear();
    },
  };
}
