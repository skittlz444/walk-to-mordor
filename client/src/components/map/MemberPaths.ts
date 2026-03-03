/**
 * MemberPaths – renders color-coded Konva.Line segments for each party member.
 *
 * Each member gets a segment from 0 to their contribution distance on the path.
 * Colors are assigned deterministically via the party-colors palette.
 * Departed members use muted colors.
 */

import Konva from 'konva';
import { fellowshipPath } from '../../data/paths/fellowship-path';
import { calculatePathSegment, dynamicStrokeWidth } from '../../utils/map-utils';
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
 */
export function createMemberPaths(
  layer: Konva.Layer,
  members: MemberPathData[],
  scale: number,
): MemberPathNodes {
  const strokeWidth = dynamicStrokeWidth(BASE_STROKE, scale, MIN_STROKE, MAX_STROKE);
  const lines: Konva.Line[] = [];

  // Calculate cumulative offsets so each member's segment starts
  // where the previous one ended (stacked along the path).
  let cumOffset = 0;
  const segments = members.map(member => {
    const start = cumOffset;
    const end = cumOffset + member.distanceMiles;
    cumOffset = end;
    return { member, start, end };
  });

  for (const { member, start, end } of segments) {
    if (member.distanceMiles <= 0) continue;

    const segmentPoints = calculatePathSegment(
      fellowshipPath,
      start,
      end,
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
