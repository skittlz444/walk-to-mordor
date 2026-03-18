/**
 * UserMarker – renders the user's current position marker on the Konva map.
 *
 * Uses Konva's imperative API (react-konva is incompatible with preact/compat).
 * The marker prefers the current user's avatar thumbnail when available and
 * falls back to the existing gold ring treatment when no avatar is set or the
 * thumbnail fails to load.
 */

import Konva from 'konva';
import type { Point } from '../../utils/map-utils';
import { markerScale, MILES_TO_KM } from '../../utils/map-utils';

/** Visual size of the marker in screen pixels (maintained across zoom levels). */
const MARKER_SIZE = 32;
const MARKER_HALF = MARKER_SIZE / 2;

/**
 * Calculate the marker scale factor for the user marker.
 * Delegates to the shared `markerScale` utility with UserMarker-specific
 * settings (base=6, min=2, max=20).
 */
function userMarkerScale(stageScale: number): number {
  return markerScale(stageScale, 6, 2, 20);
}

/** Marker colors */
const RING_COLOR = '#DAA520';        // Goldenrod
const RING_STROKE_COLOR = '#FFFFFF'; // White outer ring
const HALO_COLOR = '#daa520';        // Gold halo
const TOOLTIP_BG = '#1a1a2e';
const TOOLTIP_TEXT_COLOR = '#e0e0e0';

/** Animation duration for position transitions in milliseconds */
const ANIMATION_DURATION_MS = 400;

function getAvatarThumbPath(avatarId: string): string {
  return `/img/avatars/thumbs/${avatarId}.webp`;
}

export interface UserMarkerNodes {
  group: Konva.Group;
  tooltip: Konva.Label;
  /** Update marker position with optional animation. */
  setPosition: (pos: Point, animate?: boolean) => void;
  /** Update inverse scale for zoom independence. */
  setScale: (stageScale: number) => void;
  /** Update the distance displayed in the tooltip. */
  setDistance: (distanceMiles: number) => void;
  /** Animate marker along a series of points (for path-following animation). */
  animateAlongPoints: (points: Point[], onComplete?: () => void) => void;
  /** Destroy the marker and clean up. */
  destroy: () => void;
}

/**
 * Create the user position marker on a Konva layer.
 *
 * @param layer       The Konva layer to add the marker to.
 * @param position    Initial {x, y} position in map coordinates.
 * @param stageScale  Current zoom scale (for inverse scaling).
 * @param distanceMiles  User's current distance in miles (for tooltip).
 * @param avatarId    Optional current-user avatar slug for thumbnail rendering.
 * @returns UserMarkerNodes with references and control methods.
 */
export function createUserMarker(
  layer: Konva.Layer,
  position: Point,
  stageScale: number,
  distanceMiles: number,
  avatarId?: string | null,
): UserMarkerNodes {
  const scale = userMarkerScale(stageScale);
  const destroyedRef = { current: false };

  // Main group positioned at the user's location
  const group = new Konva.Group({
    x: position.x,
    y: position.y,
    scaleX: scale,
    scaleY: scale,
  });

  // Outer halo / glow effect
  const halo = new Konva.Circle({
    x: 0,
    y: 0,
    radius: MARKER_HALF + 4,
    fill: HALO_COLOR,
    opacity: 0.3,
  });
  group.add(halo);

  // Main marker circle (fallback)
  const markerCircle = new Konva.Circle({
    x: 0,
    y: 0,
    radius: MARKER_HALF - 2,
    fill: RING_COLOR,
    stroke: RING_STROKE_COLOR,
    strokeWidth: 3,
    shadowColor: '#000000',
    shadowBlur: 6,
    shadowOpacity: 0.4,
  });
  group.add(markerCircle);

  // Inner ring detail (to look like the One Ring)
  const innerRing = new Konva.Circle({
    x: 0,
    y: 0,
    radius: MARKER_HALF - 8,
    stroke: '#B8860B',
    strokeWidth: 2,
    fill: 'transparent',
  });
  group.add(innerRing);

  let pendingImage: HTMLImageElement | null = null;
  let avatarClipGroup: Konva.Group | null = null;
  let avatarBorder: Konva.Circle | null = null;

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

  const tooltipText = new Konva.Text({
    text: `Current Location: ${Math.round(distanceMiles * MILES_TO_KM)} km`,
    fontFamily: 'system-ui, sans-serif',
    fontSize: 12,
    padding: 6,
    fill: TOOLTIP_TEXT_COLOR,
  });
  tooltip.add(tooltipText);
  group.add(tooltip);

  if (avatarId) {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    pendingImage = img;
    img.onload = () => {
      pendingImage = null;
      if (destroyedRef.current) return;

      markerCircle.visible(false);
      innerRing.visible(false);

      const avatarImage = new Konva.Image({
        image: img,
        x: -MARKER_HALF + 2,
        y: -MARKER_HALF + 2,
        width: MARKER_SIZE - 4,
        height: MARKER_SIZE - 4,
      });

      avatarClipGroup = new Konva.Group({
        clipFunc: (ctx: Konva.Context) => {
          ctx.arc(0, 0, MARKER_HALF - 2, 0, Math.PI * 2, false);
        },
      });
      avatarClipGroup.add(avatarImage);
      group.add(avatarClipGroup);
      avatarBorder = new Konva.Circle({
        x: 0,
        y: 0,
        radius: MARKER_HALF,
        stroke: RING_STROKE_COLOR,
        strokeWidth: 2,
        fill: 'transparent',
      });
      group.add(avatarBorder);
      tooltip.moveToTop();
      layer.batchDraw();
    };
    img.onerror = () => {
      pendingImage = null;
    };
    img.src = getAvatarThumbPath(avatarId);
  }

  // Interactivity: show tooltip on hover/tap
  group.on('mouseenter', () => {
    tooltip.visible(true);
    layer.batchDraw();
  });
  group.on('mouseleave', () => {
    tooltip.visible(false);
    layer.batchDraw();
  });
  group.on('tap', () => {
    const isVisible = tooltip.visible();
    tooltip.visible(!isVisible);
    layer.batchDraw();
  });

  // Enable hit detection
  group.listening(true);

  layer.add(group);

  // Pulsing halo animation
  const haloAnim = new Konva.Animation((frame) => {
    if (!frame) return;
    const period = 2000;
    const scale = 1 + 0.15 * Math.sin((frame.time * 2 * Math.PI) / period);
    halo.scaleX(scale);
    halo.scaleY(scale);
    halo.opacity(0.3 - 0.1 * Math.sin((frame.time * 2 * Math.PI) / period));
  }, layer);
  haloAnim.start();

  const nodes: UserMarkerNodes = {
    group,
    tooltip,

    setPosition(pos: Point, animate = false) {
      if (animate) {
        group.to({
          x: pos.x,
          y: pos.y,
          duration: ANIMATION_DURATION_MS / 1000,
          easing: Konva.Easings.EaseInOut,
        });
      } else {
        group.x(pos.x);
        group.y(pos.y);
        layer.batchDraw();
      }
    },

    setScale(stageScale: number) {
      const s = userMarkerScale(stageScale);
      group.scaleX(s);
      group.scaleY(s);
    },

    setDistance(distanceMiles: number) {
      tooltipText.text(`Current Location: ${Math.round(distanceMiles * MILES_TO_KM)} km`);
    },

    animateAlongPoints(points: Point[], onComplete?: () => void) {
      if (points.length === 0) {
        if (onComplete) onComplete();
        return;
      }

      // Calculate total path length for even speed
      let totalLength = 0;
      for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        totalLength += Math.sqrt(dx * dx + dy * dy);
      }

      if (totalLength === 0) {
        group.x(points[points.length - 1].x);
        group.y(points[points.length - 1].y);
        layer.batchDraw();
        if (onComplete) onComplete();
        return;
      }

      // Animate along the path segments sequentially
      const totalDurationMs = Math.min(
        ANIMATION_DURATION_MS * 2,
        Math.max(ANIMATION_DURATION_MS, totalLength * 0.5),
      );
      let currentIndex = 0;

      function animateNext() {
        if (currentIndex >= points.length - 1) {
          if (onComplete) onComplete();
          return;
        }

        const next = points[currentIndex + 1];
        const dx = next.x - points[currentIndex].x;
        const dy = next.y - points[currentIndex].y;
        const segLen = Math.sqrt(dx * dx + dy * dy);
        const segDuration = (segLen / totalLength) * (totalDurationMs / 1000);

        currentIndex++;

        group.to({
          x: next.x,
          y: next.y,
          duration: Math.max(0.02, segDuration),
          easing: Konva.Easings.Linear,
          onFinish: animateNext,
        });
      }

      animateNext();
    },

    destroy() {
      destroyedRef.current = true;
      if (pendingImage) {
        pendingImage.onload = null;
        pendingImage.onerror = null;
        pendingImage = null;
      }
      avatarClipGroup = null;
      avatarBorder = null;
      haloAnim.stop();
      group.destroy();
    },
  };

  return nodes;
}
