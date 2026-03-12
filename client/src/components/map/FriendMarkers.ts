/**
 * FriendMarkers – renders friend avatar markers on the Konva map.
 *
 * Follows the UserMarker.ts / WaypointMarkers.ts imperative Konva pattern.
 * Each friend is rendered as a 32px circular marker with either their avatar
 * image or an initials fallback. Markers live on a dedicated Konva layer
 * between the path layer and the user marker layer.
 *
 * Exports createFriendMarkers(), which returns a FriendMarkerNodes object
 * with update, setScale, updateVisibility, and destroy methods.
 */

import Konva from 'konva';
import type { PathNode } from '../../data/paths/fellowship-path';
import { getUserPosition, markerScale, KM_TO_MILES, type Point } from '../../utils/map-utils';

/** Visual size of friend markers in screen pixels. */
const MARKER_SIZE = 32;
const MARKER_HALF = MARKER_SIZE / 2;

/** Viewport margin (px) for frustum culling. */
const CULLING_MARGIN = 50;

export interface FriendMarkerData {
  user_id: number;
  username: string;
  avatar_id: string | null;
  total_distance: number; // km
}

export interface FriendMarkerNodes {
  layer: Konva.Layer;
  markers: Map<number, Konva.Group>;
  /** Create/update markers for a new set of friends. */
  update(friends: FriendMarkerData[], pathNodes: PathNode[], stageScale: number): void;
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
 * Generate a deterministic HSL background colour for a username.
 * Used for initials fallback when no avatar is set.
 */
function getInitialsColor(username: string): string {
  const hue = (username.charCodeAt(0) * 137) % 360;
  return `hsl(${hue}, 50%, 35%)`;
}

/**
 * Calculate the friend marker scale factor.
 * Uses markerScale with slightly smaller max than UserMarker (16 vs 20)
 * so friends are subtly smaller at extreme zoom-out.
 */
function friendMarkerScale(stageScale: number): number {
  return markerScale(stageScale, 6, 2, 16);
}

/**
 * Build a single friend marker group (Konva.Group).
 * Renders initials immediately, then async-loads avatar image if available.
 */
function buildFriendMarkerGroup(
  friend: FriendMarkerData,
  position: Point,
  scale: number,
  layer: Konva.Layer,
  onSelect: (friend: FriendMarkerData) => void,
  destroyedRef: { current: boolean },
  pendingImages: Set<HTMLImageElement>,
): Konva.Group {
  const group = new Konva.Group({
    x: position.x,
    y: position.y,
    scaleX: scale,
    scaleY: scale,
    name: `friend-marker-${friend.user_id}`,
  });

  // White border circle
  const border = new Konva.Circle({
    x: 0,
    y: 0,
    radius: MARKER_HALF,
    stroke: '#FFFFFF',
    strokeWidth: 2,
    fill: 'transparent',
  });

  if (friend.avatar_id) {
    // Avatar image: render initials as fallback, then swap when image loads
    const bgCircle = new Konva.Circle({
      x: 0,
      y: 0,
      radius: MARKER_HALF - 2,
      fill: getInitialsColor(friend.username),
    });

    const initial = new Konva.Text({
      text: friend.username.charAt(0).toUpperCase(),
      fontSize: 14,
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

    group.add(bgCircle);
    group.add(initial);
    group.add(border);

    // Async load avatar image
    const thumbUrl = `/img/avatars/thumbs/${friend.avatar_id}.webp`;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
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
  } else {
    // No avatar: render initials circle
    const bgCircle = new Konva.Circle({
      x: 0,
      y: 0,
      radius: MARKER_HALF - 2,
      fill: getInitialsColor(friend.username),
    });

    const initial = new Konva.Text({
      text: friend.username.charAt(0).toUpperCase(),
      fontSize: 14,
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

    group.add(bgCircle);
    group.add(initial);
    group.add(border);
  }

  // Click/tap handler for friend selection
  group.on('click tap', (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
    onSelect(friend);
  });

  group.listening(true);
  return group;
}

/**
 * Create the friend marker system on the Konva stage.
 *
 * @param stage              The Konva stage.
 * @param markerLayer        The existing marker layer (user marker + waypoints) —
 *                           the friend layer will be inserted before this layer.
 * @param onSelect           Callback when a friend marker is clicked/tapped.
 * @returns FriendMarkerNodes with references and control methods.
 */
export function createFriendMarkers(
  stage: Konva.Stage,
  markerLayer: Konva.Layer,
  onSelect: (friend: FriendMarkerData) => void,
): FriendMarkerNodes {
  const layer = new Konva.Layer({ listening: true });
  stage.add(layer);

  // Ensure friend markers render above paths but below user marker layer.
  // Move friend layer to just before the marker layer.
  layer.moveToTop();
  markerLayer.moveToTop();

  const markers = new Map<number, Konva.Group>();

  /** Map coordinates for each friend (for visibility culling). */
  const positions = new Map<number, Point>();

  /** Track destruction state to guard async image loads. */
  const destroyedRef = { current: false };
  /** Track pending image loads for cleanup on destroy. */
  const pendingImages = new Set<HTMLImageElement>();

  const nodes: FriendMarkerNodes = {
    layer,
    markers,

    update(friends: FriendMarkerData[], pathNodes: PathNode[], stageScale: number) {
      const scale = friendMarkerScale(stageScale);

      // Remove markers for friends no longer in the list
      const newIds = new Set(friends.map(f => f.user_id));
      for (const [id, group] of markers) {
        if (!newIds.has(id)) {
          group.destroy();
          markers.delete(id);
          positions.delete(id);
        }
      }

      // Add or update markers for current friends
      for (const friend of friends) {
        const distanceMiles = friend.total_distance * KM_TO_MILES;
        const pos = getUserPosition(pathNodes, distanceMiles);

        if (markers.has(friend.user_id)) {
          // Update existing marker position and scale
          const group = markers.get(friend.user_id)!;
          group.x(pos.x);
          group.y(pos.y);
          group.scaleX(scale);
          group.scaleY(scale);
        } else {
          // Create new marker
          const group = buildFriendMarkerGroup(friend, pos, scale, layer, onSelect, destroyedRef, pendingImages);
          layer.add(group);
          markers.set(friend.user_id, group);
        }
        positions.set(friend.user_id, pos);
      }

      layer.batchDraw();
    },

    setScale(stageScale: number) {
      const scale = friendMarkerScale(stageScale);
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

        // Check if marker position is within the viewport bounds (with margin)
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
