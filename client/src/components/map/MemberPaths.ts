/**
 * MemberPaths – renders color-coded Konva.Line segments for each party member.
 *
 * Member segments are stacked end-to-end along the shared path so each
 * contribution occupies its own contiguous section.  Segments are split
 * by **pixel proportion** (not geographic miles) so that every member's
 * visual segment length matches their contribution ratio regardless of
 * the underlying anchor-to-pixel density of the path data.
 *
 * Colors are assigned deterministically via the party-colors palette.
 * Departed members use muted colors.
 */

import Konva from 'konva';
import { fellowshipPath } from '../../data/paths/fellowship-path';
import {
  calculateCutoffPoint,
  computePathLength,
  slicePathByPixelDistance,
  dynamicStrokeWidth,
} from '../../utils/map-utils';
import { getMemberColor, getMutedMemberColor } from '../../utils/party-colors';

const BASE_STROKE = 4;
const MIN_STROKE = 1.5;
const MAX_STROKE = 8;
const LINE_CAP: CanvasLineCap = 'round';
const LINE_JOIN: CanvasLineJoin = 'round';

export interface MemberPathData {
  userId: number;
  displayName: string;
  /** Contribution distance in miles */
  distanceMiles: number;
  colorIndex: number;
  isDeparted: boolean;
}

export interface MemberPathNodes {
  lines: Konva.Line[];
  destroy(): void;
}

/**
 * Create Konva.Line nodes for each member's contribution on the path layer.
 *
 * The completed path (0 → total miles) is split into segments whose pixel
 * lengths are proportional to each member's contribution, ensuring visually
 * balanced coloring regardless of the path's anchor density.
 */
export function createMemberPaths(
  layer: Konva.Layer,
  members: MemberPathData[],
  scale: number,
): MemberPathNodes {
  const strokeWidth = dynamicStrokeWidth(BASE_STROKE, scale, MIN_STROKE, MAX_STROKE);
  const lines: Konva.Line[] = [];

  // Calculate total distance to get the full completed path
  const totalMiles = members.reduce((sum, m) => sum + m.distanceMiles, 0);
  if (totalMiles <= 0) {
    return { lines, destroy() { lines.length = 0; } };
  }

  // Get the completed path from 0 to the total party distance
  const { completedPoints } = calculateCutoffPoint(fellowshipPath, totalMiles);
  if (completedPoints.length < 4) {
    return { lines, destroy() { lines.length = 0; } };
  }

  // Compute total pixel length of the completed path
  const totalPixelLength = computePathLength(completedPoints);
  if (totalPixelLength <= 0) {
    return { lines, destroy() { lines.length = 0; } };
  }

  // Split the completed path proportionally by pixel distance
  let cumPixels = 0;

  for (const member of members) {
    if (member.distanceMiles <= 0) continue;

    const startPx = cumPixels;
    const pixelShare = (member.distanceMiles / totalMiles) * totalPixelLength;
    cumPixels += pixelShare;

    const segmentPoints = slicePathByPixelDistance(
      completedPoints,
      startPx,
      cumPixels,
    );

    if (segmentPoints.length === 0) continue;

    const color = member.isDeparted
      ? getMutedMemberColor(member.colorIndex)
      : getMemberColor(member.colorIndex);

    const line = new Konva.Line({
      points: segmentPoints,
      stroke: color,
      strokeWidth,
      opacity: member.isDeparted ? 0.5 : 0.85,
      lineCap: LINE_CAP,
      lineJoin: LINE_JOIN,
      listening: false,
      tension: 0.25,
    });

    layer.add(line);
    lines.push(line);
  }

  return {
    lines,
    destroy() {
      for (const line of lines) {
        line.destroy();
      }
      lines.length = 0;
    },
  };
}

/**
 * Update member path stroke widths for zoom changes.
 */
export function updateMemberPaths(
  nodes: MemberPathNodes,
  scale: number,
): void {
  const strokeWidth = dynamicStrokeWidth(BASE_STROKE, scale, MIN_STROKE, MAX_STROKE);
  for (const line of nodes.lines) {
    line.strokeWidth(strokeWidth);
  }
}
