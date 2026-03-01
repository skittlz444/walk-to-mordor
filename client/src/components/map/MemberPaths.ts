/**
 * MemberPaths – renders color-coded Konva.Line segments for each party member.
 *
 * Each member gets a segment from 0 to their contribution distance on the path.
 * Colors are assigned deterministically via the party-colors palette.
 * Departed members use muted colors.
 */

import Konva from 'konva';
import { fellowshipPath } from '../../data/paths/fellowship-path';
import { calculateCutoffPoint, dynamicStrokeWidth } from '../../utils/map-utils';
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

  // Sort by distance so shorter paths are drawn on top of longer ones
  const sorted = [...members].sort((a, b) => b.distanceMiles - a.distanceMiles);

  for (const member of sorted) {
    if (member.distanceMiles <= 0) continue;

    const { completedPoints } = calculateCutoffPoint(
      fellowshipPath,
      member.distanceMiles,
    );

    const color = member.isDeparted
      ? getMutedMemberColor(member.colorIndex)
      : getMemberColor(member.colorIndex);

    const line = new Konva.Line({
      points: completedPoints,
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
