/**
 * Utility functions for waypoint popup positioning and map centering.
 *
 * Handles conversion between canvas/map coordinates and screen coordinates,
 * optimal popup placement to avoid viewport overflow, and safe-zone-based
 * map panning calculations.
 */

/** Popup placement direction relative to the waypoint marker. */
export type PopupPlacement = 'above' | 'below' | 'left' | 'right';

export interface ScreenPosition {
  x: number;
  y: number;
}

export interface PopupPositionResult {
  x: number;
  y: number;
  placement: PopupPlacement;
}

export interface SafeZoneBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface PanOffset {
  dx: number;
  dy: number;
}

export interface PopupSize {
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

/** Offset (px) between waypoint marker and popup edge. */
const POPUP_OFFSET = 30;

/**
 * Convert waypoint map coordinates to screen (DOM) coordinates.
 *
 * @param waypoint  Object with x, y in map-space.
 * @param stagePosition  Current stage position { x, y } in screen pixels.
 * @param stageScale     Current zoom scale of the stage.
 * @returns Screen coordinates { x, y }.
 */
export function getScreenPosition(
  waypoint: { x: number; y: number },
  stagePosition: { x: number; y: number },
  stageScale: number,
): ScreenPosition {
  return {
    x: waypoint.x * stageScale + stagePosition.x,
    y: waypoint.y * stageScale + stagePosition.y,
  };
}

/**
 * Determine the optimal popup placement and position to keep it within the viewport.
 *
 * @param waypointScreenPos  Waypoint position in screen pixels.
 * @param popupSize          Popup dimensions { width, height }.
 * @param viewportSize       Viewport dimensions { width, height }.
 * @returns Adjusted popup position and chosen placement.
 */
export function getOptimalPopupPosition(
  waypointScreenPos: ScreenPosition,
  popupSize: PopupSize,
  viewportSize: ViewportSize,
): PopupPositionResult {
  const { x: wx, y: wy } = waypointScreenPos;
  const { width: pw, height: ph } = popupSize;
  const { width: vw, height: vh } = viewportSize;

  // Available space in each direction
  const spaceAbove = wy;
  const spaceBelow = vh - wy;
  const _spaceLeft = wx;
  const spaceRight = vw - wx;

  // Determine best vertical/horizontal placement
  let placement: PopupPlacement;

  // Prefer above, then below, then right, then left
  if (spaceAbove >= ph + POPUP_OFFSET) {
    placement = 'above';
  } else if (spaceBelow >= ph + POPUP_OFFSET) {
    placement = 'below';
  } else if (spaceRight >= pw + POPUP_OFFSET) {
    placement = 'right';
  } else {
    placement = 'left';
  }

  let x: number;
  let y: number;

  switch (placement) {
    case 'above':
      x = wx - pw / 2;
      y = wy - ph - POPUP_OFFSET;
      break;
    case 'below':
      x = wx - pw / 2;
      y = wy + POPUP_OFFSET;
      break;
    case 'right':
      x = wx + POPUP_OFFSET;
      y = wy - ph / 2;
      break;
    case 'left':
      x = wx - pw - POPUP_OFFSET;
      y = wy - ph / 2;
      break;
  }

  // Clamp to viewport bounds with small margin
  const margin = 8;
  x = Math.max(margin, Math.min(vw - pw - margin, x));
  y = Math.max(margin, Math.min(vh - ph - margin, y));

  return { x, y, placement };
}

/**
 * Calculate the safe zone bounds (25% margin from all edges).
 * The safe zone is the center 50% of the viewport.
 */
export function calculateSafeZoneBounds(
  viewportWidth: number,
  viewportHeight: number,
): SafeZoneBounds {
  const marginX = viewportWidth * 0.25;
  const marginY = viewportHeight * 0.25;
  return {
    minX: marginX,
    maxX: viewportWidth - marginX,
    minY: marginY,
    maxY: viewportHeight - marginY,
  };
}

/**
 * Check if a point is within the safe zone bounds.
 */
export function isWithinSafeZone(
  point: ScreenPosition,
  bounds: SafeZoneBounds,
): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}

/**
 * Calculate the pan offset needed to bring the waypoint (and popup on desktop)
 * into the viewport's safe zone.
 *
 * Desktop: combines the marker + popup bounding box and checks its center.
 * Mobile:  only considers the marker position (bottom sheet doesn't affect positioning).
 *
 * Returns null if already within the safe zone (no pan needed).
 *
 * @param waypointScreenPos  Waypoint position in screen pixels.
 * @param popupSize          Popup dimensions { width, height }.
 * @param viewportSize       Viewport dimensions { width, height }.
 * @param isMobile           Whether to use mobile logic (marker only).
 * @returns Pan offset { dx, dy } or null if no pan needed.
 */
export function calculatePanOffset(
  waypointScreenPos: ScreenPosition,
  popupSize: PopupSize,
  viewportSize: ViewportSize,
  isMobile: boolean,
): PanOffset | null {
  const bounds = calculateSafeZoneBounds(viewportSize.width, viewportSize.height);

  let targetCenter: ScreenPosition;

  if (isMobile) {
    // Mobile: only marker position matters
    targetCenter = { x: waypointScreenPos.x, y: waypointScreenPos.y };
  } else {
    // Desktop: combined bounding box center of marker + popup
    const popupPos = getOptimalPopupPosition(waypointScreenPos, popupSize, viewportSize);

    const minX = Math.min(waypointScreenPos.x, popupPos.x);
    const maxX = Math.max(waypointScreenPos.x, popupPos.x + popupSize.width);
    const minY = Math.min(waypointScreenPos.y, popupPos.y);
    const maxY = Math.max(waypointScreenPos.y, popupPos.y + popupSize.height);

    targetCenter = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    };
  }

  if (isWithinSafeZone(targetCenter, bounds)) {
    return null; // Already in safe zone
  }

  // Calculate delta to move center toward safe zone (stop at edge, don't overshoot)
  let dx = 0;
  let dy = 0;

  if (targetCenter.x < bounds.minX) {
    dx = bounds.minX - targetCenter.x;
  } else if (targetCenter.x > bounds.maxX) {
    dx = bounds.maxX - targetCenter.x;
  }

  if (targetCenter.y < bounds.minY) {
    dy = bounds.minY - targetCenter.y;
  } else if (targetCenter.y > bounds.maxY) {
    dy = bounds.maxY - targetCenter.y;
  }

  return { dx, dy };
}
