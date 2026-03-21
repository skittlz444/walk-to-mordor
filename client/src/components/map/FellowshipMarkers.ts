/**
 * FellowshipMarkers – renders fellowship group markers on the Konva map.
 *
 * Follows the FriendMarkers.ts imperative Konva pattern.
 * Each fellowship is rendered as a 36px circular marker with a group icon
 * (silhouette of multiple people) and the fellowship name as a tooltip.
 * Markers live on a dedicated Konva layer.
 *
 * Exports createFellowshipMarkers(), which returns a FellowshipMarkerNodes
 * object with update, setScale, updateVisibility, and destroy methods.
 */

import Konva from 'konva';
import type { PathNode } from '../../data/paths/fellowship-path';
import { getUserPosition, markerScale, KM_TO_MILES, MILES_TO_KM, type Point } from '../../utils/map-utils';

/** Visual size of fellowship markers in screen pixels. */
const MARKER_SIZE = 36;
const MARKER_HALF = MARKER_SIZE / 2;

/** Viewport margin (px) for frustum culling. */
const CULLING_MARGIN = 50;

/** Fellowship marker colors */
const MARKER_BG = '#2A1F0E';
const MARKER_BORDER = '#DAA520';
const ICON_COLOR = '#DAA520';
const TOOLTIP_BG = '#1a1a2e';
const TOOLTIP_TEXT_COLOR = '#e0e0e0';

export interface FellowshipMarkerData {
  party_id: number;
  name: string;
  total_distance: number; // km
}

export interface FellowshipMarkerNodes {
  layer: Konva.Layer;
  markers: Map<number, Konva.Group>;
  /** Create/update markers for a new set of fellowships. */
  update(fellowships: FellowshipMarkerData[], pathNodes: PathNode[], stageScale: number): void;
  /** Update inverse scale for zoom independence. */
  setScale(stageScale: number): void;
  /** Frustum culling: show/hide markers based on viewport bounds. */
  updateVisibility(viewportBounds: ViewportBounds): void;
  /** Remove all markers and the layer from the stage. */
  destroy(): void;
}

export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate the fellowship marker scale factor.
 * Uses markerScale with slightly larger max than FriendMarkers (18 vs 16).
 */
function fellowshipMarkerScale(stageScale: number): number {
  return markerScale(stageScale, 6, 2, 18);
}

/**
 * Build a single fellowship marker group (Konva.Group).
 * Renders a group icon (stylized people silhouette) with a golden border.
 */
function buildFellowshipMarkerGroup(
  fellowship: FellowshipMarkerData,
  position: Point,
  scale: number,
): Konva.Group {
  const group = new Konva.Group({
    x: position.x,
    y: position.y,
    scaleX: scale,
    scaleY: scale,
    name: `fellowship-marker-${fellowship.party_id}`,
  });

  // Background circle
  const bgCircle = new Konva.Circle({
    x: 0,
    y: 0,
    radius: MARKER_HALF - 2,
    fill: MARKER_BG,
  });
  group.add(bgCircle);

  // Group icon — three small circles representing people
  const iconGroup = new Konva.Group();

  // Center person (slightly larger)
  iconGroup.add(new Konva.Circle({
    x: 0,
    y: -3,
    radius: 4,
    fill: ICON_COLOR,
  }));
  // Center body
  iconGroup.add(new Konva.Rect({
    x: -4,
    y: 2,
    width: 8,
    height: 6,
    fill: ICON_COLOR,
    cornerRadius: 2,
  }));

  // Left person (smaller)
  iconGroup.add(new Konva.Circle({
    x: -8,
    y: -1,
    radius: 3,
    fill: ICON_COLOR,
    opacity: 0.8,
  }));
  // Left body
  iconGroup.add(new Konva.Rect({
    x: -11,
    y: 3,
    width: 6,
    height: 5,
    fill: ICON_COLOR,
    cornerRadius: 2,
    opacity: 0.8,
  }));

  // Right person (smaller)
  iconGroup.add(new Konva.Circle({
    x: 8,
    y: -1,
    radius: 3,
    fill: ICON_COLOR,
    opacity: 0.8,
  }));
  // Right body
  iconGroup.add(new Konva.Rect({
    x: 5,
    y: 3,
    width: 6,
    height: 5,
    fill: ICON_COLOR,
    cornerRadius: 2,
    opacity: 0.8,
  }));

  group.add(iconGroup);

  // Golden border circle
  const border = new Konva.Circle({
    x: 0,
    y: 0,
    radius: MARKER_HALF,
    stroke: MARKER_BORDER,
    strokeWidth: 2.5,
    fill: 'transparent',
  });
  group.add(border);

  // Tooltip (hidden by default)
  const tooltip = new Konva.Label({
    x: 0,
    y: -(MARKER_HALF + 8),
    visible: false,
    opacity: 0.95,
  });

  tooltip.add(
    new Konva.Tag({
      fill: TOOLTIP_BG,
      cornerRadius: 4,
      pointerDirection: 'down',
      pointerWidth: 10,
      pointerHeight: 6,
      shadowColor: '#000',
      shadowBlur: 4,
      shadowOpacity: 0.3,
    }),
  );

  const distKm = Math.round(fellowship.total_distance * MILES_TO_KM);
  tooltip.add(new Konva.Text({
    text: `${fellowship.name}: ${distKm} km`,
    fontFamily: 'system-ui, sans-serif',
    fontSize: 12,
    padding: 6,
    fill: TOOLTIP_TEXT_COLOR,
  }));
  group.add(tooltip);

  // Interactivity: show tooltip on hover/tap
  group.on('mouseenter', () => {
    tooltip.visible(true);
    group.getLayer()?.batchDraw();
  });
  group.on('mouseleave', () => {
    tooltip.visible(false);
    group.getLayer()?.batchDraw();
  });
  group.on('tap', () => {
    const isVisible = tooltip.visible();
    tooltip.visible(!isVisible);
    group.getLayer()?.batchDraw();
  });

  group.listening(true);
  return group;
}

/**
 * Create the fellowship marker system on the Konva stage.
 *
 * @param stage              The Konva stage.
 * @param markerLayer        The existing marker layer (user marker + waypoints) —
 *                           the fellowship layer will be inserted before this layer.
 * @returns FellowshipMarkerNodes with references and control methods.
 */
export function createFellowshipMarkers(
  stage: Konva.Stage,
  markerLayer: Konva.Layer,
): FellowshipMarkerNodes {
  const layer = new Konva.Layer({ listening: true });
  stage.add(layer);

  // Ensure fellowship markers render above paths but below user marker layer.
  layer.moveToTop();
  markerLayer.moveToTop();

  const markers = new Map<number, Konva.Group>();

  /** Map coordinates for each fellowship (for visibility culling). */
  const positions = new Map<number, Point>();

  const nodes: FellowshipMarkerNodes = {
    layer,
    markers,

    update(fellowships: FellowshipMarkerData[], pathNodes: PathNode[], stageScale: number) {
      const scale = fellowshipMarkerScale(stageScale);

      // Remove markers for fellowships no longer in the list
      const newIds = new Set(fellowships.map(f => f.party_id));
      for (const [id, group] of markers) {
        if (!newIds.has(id)) {
          group.destroy();
          markers.delete(id);
          positions.delete(id);
        }
      }

      // Add or update markers for current fellowships
      for (const fellowship of fellowships) {
        const distanceMiles = fellowship.total_distance * KM_TO_MILES;
        const pos = getUserPosition(pathNodes, distanceMiles);

        if (markers.has(fellowship.party_id)) {
          // Update existing marker position and scale
          const group = markers.get(fellowship.party_id)!;
          group.x(pos.x);
          group.y(pos.y);
          group.scaleX(scale);
          group.scaleY(scale);
        } else {
          // Create new marker
          const group = buildFellowshipMarkerGroup(fellowship, pos, scale);
          layer.add(group);
          markers.set(fellowship.party_id, group);
        }
        positions.set(fellowship.party_id, pos);
      }

      layer.batchDraw();
    },

    setScale(stageScale: number) {
      const scale = fellowshipMarkerScale(stageScale);
      for (const group of markers.values()) {
        group.scaleX(scale);
        group.scaleY(scale);
      }
      layer.batchDraw();
    },

    updateVisibility(viewportBounds: ViewportBounds) {
      const { x: vx, y: vy, width: vw, height: vh } = viewportBounds;
      const margin = CULLING_MARGIN;

      for (const [id, group] of markers) {
        const pos = positions.get(id);
        if (!pos) {
          group.visible(false);
          continue;
        }

        const inBounds =
          pos.x >= vx - margin &&
          pos.x <= vx + vw + margin &&
          pos.y >= vy - margin &&
          pos.y <= vy + vh + margin;

        group.visible(inBounds);
      }
      layer.batchDraw();
    },

    destroy() {
      for (const group of markers.values()) {
        group.destroy();
      }
      markers.clear();
      positions.clear();
      layer.destroy();
    },
  };

  return nodes;
}
