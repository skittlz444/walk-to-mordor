/**
 * FellowshipMarkers – renders fellowship avatar markers on the Konva map.
 *
 * Follows the FriendMarkers.ts imperative Konva pattern.
 * Each fellowship is rendered as a 36px circular marker with either a leader-set
 * avatar image or an initials fallback (first letter of the fellowship name).
 * Markers live on a dedicated Konva layer.
 *
 * Exports createFellowshipMarkers(), which returns a FellowshipMarkerNodes
 * object with update, setScale, updateVisibility, and destroy methods.
 */

import Konva from 'konva';
import type { PathNode } from '../../data/paths/fellowship-path';
import { getUserPosition, markerScale, KM_TO_MILES, type Point } from '../../utils/map-utils';

/** Visual size of fellowship markers in screen pixels. */
const MARKER_SIZE = 36;
const MARKER_HALF = MARKER_SIZE / 2;

/** Viewport margin (px) for frustum culling. */
const CULLING_MARGIN = 50;

/** Fellowship marker colors */
const MARKER_BORDER = '#DAA520';
const TOOLTIP_BG = '#1a1a2e';
const TOOLTIP_TEXT_COLOR = '#e0e0e0';

export interface FellowshipMarkerData {
  party_id: number;
  name: string;
  total_distance: number; // km
  avatar_id: string | null;
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
 * Generate a deterministic HSL background colour for a fellowship name.
 * Used for initials fallback when no avatar is set.
 */
function getInitialsColor(name: string): string {
  const hue = (name.charCodeAt(0) * 137) % 360;
  return `hsl(${hue}, 50%, 35%)`;
}

/**
 * Calculate the fellowship marker scale factor.
 * Uses markerScale with slightly larger max than FriendMarkers (18 vs 16).
 */
function fellowshipMarkerScale(stageScale: number): number {
  return markerScale(stageScale, 6, 2, 18);
}

/**
 * Create initials fallback elements (background circle + text initial).
 */
function createInitials(name: string): { bgCircle: Konva.Circle; initial: Konva.Text } {
  const bgCircle = new Konva.Circle({
    x: 0,
    y: 0,
    radius: MARKER_HALF - 2,
    fill: getInitialsColor(name),
  });

  const initial = new Konva.Text({
    text: name.charAt(0).toUpperCase(),
    fontSize: 16,
    fontFamily: 'system-ui, sans-serif',
    fontStyle: 'bold',
    fill: '#FFFFFF',
    align: 'center',
    verticalAlign: 'middle',
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    x: -MARKER_HALF,
    y: -MARKER_HALF,
  });

  return { bgCircle, initial };
}

/**
 * Build a single fellowship marker group (Konva.Group).
 * Renders initials immediately, then async-loads avatar image if available.
 */
function buildFellowshipMarkerGroup(
  fellowship: FellowshipMarkerData,
  position: Point,
  scale: number,
  layer: Konva.Layer,
  destroyedRef: { current: boolean },
  pendingImages: Set<HTMLImageElement>,
): Konva.Group {
  const group = new Konva.Group({
    x: position.x,
    y: position.y,
    scaleX: scale,
    scaleY: scale,
    name: `fellowship-marker-${fellowship.party_id}`,
  });

  // Golden border circle
  const border = new Konva.Circle({
    x: 0,
    y: 0,
    radius: MARKER_HALF,
    stroke: MARKER_BORDER,
    strokeWidth: 2.5,
    fill: 'transparent',
  });

  // Always render initials first (used as fallback or shown when no avatar)
  const { bgCircle, initial } = createInitials(fellowship.name);
  group.add(bgCircle);
  group.add(initial);
  group.add(border);

  if (fellowship.avatar_id) {
    // Async load avatar image, swap initials when loaded
    const thumbUrl = `/img/avatars/thumbs/${fellowship.avatar_id}.webp`;
    const img = new window.Image();
    pendingImages.add(img);
    img.onload = () => {
      pendingImages.delete(img);
      if (destroyedRef.current) return;

      // Remove the initials fallback
      bgCircle.visible(false);
      initial.visible(false);

      // Create clipped avatar image
      const avatarImage = new Konva.Image({
        image: img,
        x: -MARKER_HALF + 2,
        y: -MARKER_HALF + 2,
        width: MARKER_SIZE - 4,
        height: MARKER_SIZE - 4,
      });

      // Clip to circle using a clip group
      const clipGroup = new Konva.Group({
        clipFunc: (ctx: Konva.Context) => {
          ctx.arc(0, 0, MARKER_HALF - 2, 0, Math.PI * 2, false);
        },
      });
      clipGroup.add(avatarImage);

      // Insert before the border so the border renders on top
      group.add(clipGroup);
      clipGroup.moveToBottom();
      border.moveToTop();
      layer.batchDraw();
    };
    img.onerror = () => {
      pendingImages.delete(img);
      // Keep initials fallback on error — nothing to do
    };
    img.src = thumbUrl;
  }

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

  const distKm = Math.round(fellowship.total_distance);
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

  // Z-index stacking: move fellowship layer to top first, then marker layer
  // above it. This ensures fellowships render above paths but below the user marker.
  layer.moveToTop();
  markerLayer.moveToTop();

  const markers = new Map<number, Konva.Group>();

  /** Map coordinates for each fellowship (for visibility culling). */
  const positions = new Map<number, Point>();

  /** Track destruction state to guard async image loads. */
  const destroyedRef = { current: false };
  /** Track pending image loads for cleanup on destroy. */
  const pendingImages = new Set<HTMLImageElement>();

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
          const group = buildFellowshipMarkerGroup(fellowship, pos, scale, layer, destroyedRef, pendingImages);
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
      destroyedRef.current = true;
      // Null out pending image callbacks to prevent post-destroy access
      for (const img of pendingImages) {
        img.onload = null;
        img.onerror = null;
      }
      pendingImages.clear();
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
