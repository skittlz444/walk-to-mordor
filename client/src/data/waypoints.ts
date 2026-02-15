/**
 * Waypoint data types and coordinate calculation.
 *
 * Derives map coordinates for goal milestones by interpolating along the
 * fellowship path data. Goals store distance in km; path anchors use miles.
 */

import type { PathNode } from './paths/fellowship-path';
import type { Goal } from '../types/goal';
import { getUserPosition, type Point } from '../utils/map-utils';

/** Conversion factor: km → miles (goals are in km, path is in miles). */
const KM_TO_MILES = 0.621371;

export interface Waypoint {
  id: number;
  /** Distance in miles (converted from goal's km value). */
  distance: number;
  title: string;
  x: number;
  y: number;
  special: string | null;
}

/**
 * Compute map coordinates for each goal by interpolating along the path.
 *
 * @param pathNodes  The ordered fellowship path nodes.
 * @param goals      Goals from the API (distance in km).
 * @returns Array of waypoints with populated x, y coordinates.
 */
export function getWaypointCoordinates(
  pathNodes: PathNode[],
  goals: Goal[],
): Waypoint[] {
  return goals.map((goal) => {
    const distanceMiles = goal.distance * KM_TO_MILES;
    const pos: Point = getUserPosition(pathNodes, distanceMiles);
    return {
      id: goal.id,
      distance: distanceMiles,
      title: goal.title,
      x: pos.x,
      y: pos.y,
      special: goal.special ?? null,
    };
  });
}

/**
 * Determine waypoint visibility tier based on zoom level.
 *
 * - Low zoom (< 1.0): only major waypoints (special IS NOT NULL).
 * - Medium zoom (1.0 – 2.0): major + every 3rd non-major.
 * - High zoom (≥ 2.0): all waypoints.
 */
export type VisibilityTier = 'major' | 'expanded' | 'all';

export function getVisibilityTier(zoomLevel: number): VisibilityTier {
  if (zoomLevel < 1.0) return 'major';
  if (zoomLevel < 2.0) return 'expanded';
  return 'all';
}

/**
 * Return true if the waypoint is considered "major" (has special text).
 */
export function isMajorWaypoint(wp: Waypoint): boolean {
  return wp.special !== null && wp.special !== undefined && wp.special !== '';
}

/**
 * Filter waypoints based on visibility tier.
 *
 * @param waypoints  All waypoints in range.
 * @param tier       Current visibility tier from zoom level.
 * @returns Filtered waypoints to render.
 */
export function filterWaypointsByTier(
  waypoints: Waypoint[],
  tier: VisibilityTier,
): Waypoint[] {
  if (tier === 'all') return waypoints;
  if (tier === 'major') return waypoints.filter(isMajorWaypoint);
  // 'expanded': major + every 3rd non-major
  let nonMajorIndex = 0;
  return waypoints.filter((wp) => {
    if (isMajorWaypoint(wp)) return true;
    const show = nonMajorIndex % 3 === 0;
    nonMajorIndex++;
    return show;
  });
}

/** Fraction of total path distance shown as upcoming (matches JourneyPath). */
const FUTURE_VISIBLE_FRACTION = 0.07;

/**
 * Filter waypoints to only those within the visible range:
 * - All unlocked waypoints (distance ≤ userDistance).
 * - Upcoming waypoints within 7% of total path distance ahead of user.
 * - In dev mode, all waypoints are included.
 *
 * @param waypoints      All waypoints with coordinates.
 * @param userDistance    User's current distance in miles.
 * @param totalDistance   Total path distance in miles.
 * @param devMode        Whether dev mode is active (show all).
 * @returns Waypoints within visible range.
 */
export function filterWaypointsByRange(
  waypoints: Waypoint[],
  userDistance: number,
  totalDistance: number,
  devMode: boolean,
): Waypoint[] {
  if (devMode) return waypoints;
  const maxAheadDistance = userDistance + totalDistance * FUTURE_VISIBLE_FRACTION;
  return waypoints.filter((wp) => wp.distance <= maxAheadDistance);
}

/**
 * Filter waypoints to only those within the visible viewport (+ padding).
 *
 * @param waypoints  Waypoints to filter.
 * @param viewport   Viewport bounds in map coordinates.
 * @param padding    Extra padding in map-space pixels.
 * @returns Waypoints within the viewport.
 */
export function filterWaypointsByViewport(
  waypoints: Waypoint[],
  viewport: { left: number; top: number; right: number; bottom: number },
  padding: number = 100,
): Waypoint[] {
  const l = viewport.left - padding;
  const t = viewport.top - padding;
  const r = viewport.right + padding;
  const b = viewport.bottom + padding;
  return waypoints.filter(
    (wp) => wp.x >= l && wp.x <= r && wp.y >= t && wp.y <= b,
  );
}
