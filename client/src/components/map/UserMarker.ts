/**
 * UserMarker – renders the user's current position marker on the Konva map.
 *
 * Uses Konva's imperative API (react-konva is incompatible with preact/compat).
 * The marker is a gold ring shape (fallback for the One Ring icon) that:
 *   - Maintains constant visual size via inverse scaling
 *   - Shows a tooltip on hover/tap with "Current Location: X mi"
 *   - Animates smoothly to new positions along the path
 *
 * When the One Ring icon (public/img/one-ring.png) is available, it loads
 * as the marker image. Otherwise, a styled gold circle is used as fallback.
 */

import Konva from 'konva';
import type { Point } from '../../utils/map-utils';

/** Visual size of the marker in screen pixels (maintained across zoom levels). */
const MARKER_SIZE = 32;
const MARKER_HALF = MARKER_SIZE / 2;

/** Marker colors */
const RING_COLOR = '#DAA520';        // Goldenrod
const RING_STROKE_COLOR = '#FFFFFF'; // White outer ring
const HALO_COLOR = '#DAA520';        // Gold halo
const TOOLTIP_BG = '#1a1a2e';
const TOOLTIP_TEXT_COLOR = '#e0e0e0';

/** Animation duration for position transitions in milliseconds */
const ANIMATION_DURATION_MS = 400;

/** Icon image path */
const ICON_PATH = '/img/one-ring.png';

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
 * Attempt to load the One Ring icon image.
 * Returns null if loading fails (fallback shapes are used instead).
 */
function loadMarkerIcon(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn(
        `[UserMarker] Could not load icon at ${ICON_PATH}. Using fallback shape. ` +
        'Add the One Ring icon to public/img/one-ring.png to use the custom icon.',
      );
      resolve(null);
    };
    img.src = ICON_PATH;
  });
}

/**
 * Create the user position marker on a Konva layer.
 *
 * @param layer       The Konva layer to add the marker to.
 * @param position    Initial {x, y} position in map coordinates.
 * @param stageScale  Current zoom scale (for inverse scaling).
 * @param distanceMiles  User's current distance in miles (for tooltip).
 * @returns UserMarkerNodes with references and control methods.
 */
export function createUserMarker(
  layer: Konva.Layer,
  position: Point,
  stageScale: number,
  distanceMiles: number,
): UserMarkerNodes {
  const inverseScale = 1 / stageScale;

  // Main group positioned at the user's location
  const group = new Konva.Group({
    x: position.x,
    y: position.y,
    scaleX: inverseScale,
    scaleY: inverseScale,
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

  // Try to load the icon image and replace the fallback
  let markerImage: Konva.Image | null = null;
  loadMarkerIcon().then((img) => {
    if (img) {
      markerCircle.visible(false);
      innerRing.visible(false);
      markerImage = new Konva.Image({
        image: img,
        x: -MARKER_HALF,
        y: -MARKER_HALF,
        width: MARKER_SIZE,
        height: MARKER_SIZE,
      });
      // Insert before the halo so the image sits on top
      group.add(markerImage);
      layer.batchDraw();
    }
  });

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
    text: `Current Location: ${Math.round(distanceMiles)} mi`,
    fontFamily: 'system-ui, sans-serif',
    fontSize: 12,
    padding: 6,
    fill: TOOLTIP_TEXT_COLOR,
  });
  tooltip.add(tooltipText);
  group.add(tooltip);

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
      const inv = 1 / stageScale;
      group.scaleX(inv);
      group.scaleY(inv);
    },

    setDistance(distanceMiles: number) {
      tooltipText.text(`Current Location: ${Math.round(distanceMiles)} mi`);
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
      let accumulatedLength = 0;

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

        accumulatedLength += segLen;
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
      haloAnim.stop();
      group.destroy();
    },
  };

  return nodes;
}
