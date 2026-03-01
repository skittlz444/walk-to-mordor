import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Konva before importing module
const lineInstances: Array<Record<string, unknown>> = [];
vi.mock('konva', () => {
  function MockLine(options: Record<string, unknown>) {
    const instance = {
      ...options,
      strokeWidth: vi.fn(),
      destroy: vi.fn(),
    };
    lineInstances.push(instance);
    return instance;
  }
  MockLine.prototype = {};
  return {
    default: {
      Line: MockLine,
    },
  };
});

vi.mock('../../data/paths/fellowship-path', () => ({
  fellowshipPath: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 200, y: 100 },
  ],
}));

vi.mock('../../utils/map-utils', () => ({
  calculateCutoffPoint: vi.fn(() => ({
    completedPoints: [0, 0, 50, 0],
    futurePoints: [50, 0, 100, 0],
  })),
  dynamicStrokeWidth: vi.fn((_base, _scale, _min, _max) => 4),
}));

vi.mock('../../utils/party-colors', () => ({
  getMemberColor: vi.fn((idx: number) => `#color${idx}`),
  getMutedMemberColor: vi.fn((idx: number) => `#muted${idx}`),
}));

import Konva from 'konva';
import { createMemberPaths, updateMemberPaths, type MemberPathData } from './MemberPaths';
import { getMemberColor, getMutedMemberColor } from '../../utils/party-colors';

describe('MemberPaths', () => {
  let mockLayer: { add: ReturnType<typeof vi.fn>; batchDraw: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    lineInstances.length = 0;
    mockLayer = {
      add: vi.fn(),
      batchDraw: vi.fn(),
    };
  });

  describe('createMemberPaths', () => {
    it('creates lines for each member with contribution > 0', () => {
      const members: MemberPathData[] = [
        { userId: 1, displayName: 'Alice', distanceMiles: 10, colorIndex: 0, isDeparted: false },
        { userId: 2, displayName: 'Bob', distanceMiles: 5, colorIndex: 1, isDeparted: false },
      ];

      const result = createMemberPaths(mockLayer as unknown as Konva.Layer, members, 1.0);

      expect(result.lines).toHaveLength(2);
      expect(mockLayer.add).toHaveBeenCalledTimes(2);
      expect(getMemberColor).toHaveBeenCalledWith(0);
      expect(getMemberColor).toHaveBeenCalledWith(1);
    });

    it('skips members with zero contribution', () => {
      const members: MemberPathData[] = [
        { userId: 1, displayName: 'Alice', distanceMiles: 10, colorIndex: 0, isDeparted: false },
        { userId: 2, displayName: 'Bob', distanceMiles: 0, colorIndex: 1, isDeparted: false },
      ];

      const result = createMemberPaths(mockLayer as unknown as Konva.Layer, members, 1.0);

      expect(result.lines).toHaveLength(1);
      expect(mockLayer.add).toHaveBeenCalledTimes(1);
    });

    it('uses muted colors for departed members', () => {
      const members: MemberPathData[] = [
        { userId: 1, displayName: 'Alice', distanceMiles: 10, colorIndex: 3, isDeparted: true },
      ];

      createMemberPaths(mockLayer as unknown as Konva.Layer, members, 1.0);

      expect(getMutedMemberColor).toHaveBeenCalledWith(3);
      expect(getMemberColor).not.toHaveBeenCalled();
    });

    it('creates Konva.Line with correct options for active member', () => {
      const members: MemberPathData[] = [
        { userId: 1, displayName: 'Alice', distanceMiles: 10, colorIndex: 2, isDeparted: false },
      ];

      createMemberPaths(mockLayer as unknown as Konva.Layer, members, 1.5);

      expect(lineInstances).toHaveLength(1);
      expect(lineInstances[0].stroke).toBe('#color2');
      expect(lineInstances[0].opacity).toBe(0.85);
      expect(lineInstances[0].listening).toBe(false);
    });

    it('creates Konva.Line with reduced opacity for departed member', () => {
      const members: MemberPathData[] = [
        { userId: 1, displayName: 'Alice', distanceMiles: 10, colorIndex: 2, isDeparted: true },
      ];

      createMemberPaths(mockLayer as unknown as Konva.Layer, members, 1.0);

      expect(lineInstances).toHaveLength(1);
      expect(lineInstances[0].stroke).toBe('#muted2');
      expect(lineInstances[0].opacity).toBe(0.5);
    });

    it('destroy() removes all lines', () => {
      const members: MemberPathData[] = [
        { userId: 1, displayName: 'Alice', distanceMiles: 10, colorIndex: 0, isDeparted: false },
        { userId: 2, displayName: 'Bob', distanceMiles: 5, colorIndex: 1, isDeparted: false },
      ];

      const result = createMemberPaths(mockLayer as unknown as Konva.Layer, members, 1.0);

      // Get the mock destroy functions
      const destroyFns = result.lines.map(l => l.destroy);
      result.destroy();

      for (const fn of destroyFns) {
        expect(fn).toHaveBeenCalled();
      }
      expect(result.lines).toHaveLength(0);
    });
  });

  describe('updateMemberPaths', () => {
    it('updates strokeWidth on all lines', () => {
      const members: MemberPathData[] = [
        { userId: 1, displayName: 'Alice', distanceMiles: 10, colorIndex: 0, isDeparted: false },
        { userId: 2, displayName: 'Bob', distanceMiles: 5, colorIndex: 1, isDeparted: false },
      ];

      const nodes = createMemberPaths(mockLayer as unknown as Konva.Layer, members, 1.0);

      // Clear mocks from creation
      for (const line of nodes.lines) {
        (line.strokeWidth as ReturnType<typeof vi.fn>).mockClear();
      }

      updateMemberPaths(nodes, 2.0);

      for (const line of nodes.lines) {
        expect(line.strokeWidth).toHaveBeenCalledWith(4);
      }
    });
  });
});
