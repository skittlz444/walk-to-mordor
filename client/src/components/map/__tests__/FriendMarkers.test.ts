import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track created instances
const groupInstances: Array<Record<string, unknown>> = [];
const circleInstances: Array<Record<string, unknown>> = [];
const textInstances: Array<Record<string, unknown>> = [];
const layerInstances: Array<Record<string, unknown>> = [];

vi.mock('konva', () => {
  function MockGroup(options: Record<string, unknown>) {
    const handlers: Record<string, Function> = {};
    const instance: Record<string, unknown> = {
      ...options,
      x: vi.fn((v?: number) => v !== undefined ? instance : (options.x || 0)),
      y: vi.fn((v?: number) => v !== undefined ? instance : (options.y || 0)),
      scaleX: vi.fn((v?: number) => v !== undefined ? instance : (options.scaleX || 1)),
      scaleY: vi.fn((v?: number) => v !== undefined ? instance : (options.scaleY || 1)),
      name: vi.fn(() => options.name),
      add: vi.fn(),
      on: vi.fn((event: string, handler: Function) => { handlers[event] = handler; }),
      listening: vi.fn(),
      visible: vi.fn(),
      destroy: vi.fn(),
      moveToBottom: vi.fn(),
      moveToTop: vi.fn(),
      _handlers: handlers,
    };
    groupInstances.push(instance);
    return instance;
  }
  MockGroup.prototype = {};

  function MockCircle(options: Record<string, unknown>) {
    const instance = {
      ...options,
      visible: vi.fn(),
      destroy: vi.fn(),
    };
    circleInstances.push(instance);
    return instance;
  }
  MockCircle.prototype = {};

  function MockText(options: Record<string, unknown>) {
    const instance = {
      ...options,
      visible: vi.fn(),
      destroy: vi.fn(),
    };
    textInstances.push(instance);
    return instance;
  }
  MockText.prototype = {};

  function MockLayer(options: Record<string, unknown>) {
    const instance = {
      ...options,
      add: vi.fn(),
      batchDraw: vi.fn(),
      destroy: vi.fn(),
      moveToTop: vi.fn(),
    };
    layerInstances.push(instance);
    return instance;
  }
  MockLayer.prototype = {};

  function MockImage(options: Record<string, unknown>) {
    return { ...options, destroy: vi.fn() };
  }
  MockImage.prototype = {};

  return {
    default: {
      Group: MockGroup,
      Circle: MockCircle,
      Text: MockText,
      Layer: MockLayer,
      Image: MockImage,
    },
  };
});

vi.mock('../../../data/paths/fellowship-path', () => ({
  fellowshipPath: [
    { x: 0, y: 0, distance: 0 },
    { x: 100, y: 0, distance: 50 },
    { x: 200, y: 100, distance: 100 },
  ],
}));

vi.mock('../../../utils/map-utils', () => ({
  getUserPosition: vi.fn((_nodes: unknown, _dist: number) => ({ x: 50, y: 25 })),
  markerScale: vi.fn((_stageScale: number, _base: number, _min: number, _max: number) => 0.5),
  MILES_TO_KM: 1.60934,
  KM_TO_MILES: 0.621371,
}));

import type Konva from 'konva';
import { createFriendMarkers, type FriendMarkerData } from '../FriendMarkers';
import { getUserPosition, markerScale } from '../../../utils/map-utils';

describe('FriendMarkers', () => {
  let mockStage: {
    add: ReturnType<typeof vi.fn>;
    getLayers: ReturnType<typeof vi.fn>;
  };
  let mockMarkerLayer: {
    moveToTop: ReturnType<typeof vi.fn>;
  };
  const onSelect = vi.fn();

  const sampleFriends: FriendMarkerData[] = [
    { user_id: 1, username: 'samwise', avatar_id: null, total_distance: 100 },
    { user_id: 2, username: 'frodo', avatar_id: 'ring-bearer', total_distance: 200 },
  ];

  const pathNodes = [
    { x: 0, y: 0, distance: 0 },
    { x: 100, y: 0, distance: 50 },
    { x: 200, y: 100, distance: 100 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    groupInstances.length = 0;
    circleInstances.length = 0;
    textInstances.length = 0;
    layerInstances.length = 0;

    mockStage = {
      add: vi.fn(),
      getLayers: vi.fn(() => []),
    };
    mockMarkerLayer = {
      moveToTop: vi.fn(),
    };
  });

  describe('createFriendMarkers', () => {
    it('creates a new Konva.Layer and adds it to the stage', () => {
      const nodes = createFriendMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
        onSelect,
      );

      expect(mockStage.add).toHaveBeenCalledTimes(1);
      expect(nodes.layer).toBeDefined();
    });

    it('ensures marker layer is on top (friend layer below user marker)', () => {
      createFriendMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
        onSelect,
      );

      expect(mockMarkerLayer.moveToTop).toHaveBeenCalled();
    });

    it('starts with an empty markers map', () => {
      const nodes = createFriendMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
        onSelect,
      );

      expect(nodes.markers.size).toBe(0);
    });
  });

  describe('update', () => {
    it('creates marker groups for each friend', () => {
      const nodes = createFriendMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
        onSelect,
      );

      nodes.update(sampleFriends, pathNodes, 1.0);

      expect(nodes.markers.size).toBe(2);
      expect(nodes.markers.has(1)).toBe(true);
      expect(nodes.markers.has(2)).toBe(true);
    });

    it('calls getUserPosition with distance converted to miles', () => {
      const nodes = createFriendMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
        onSelect,
      );

      nodes.update(sampleFriends, pathNodes, 1.0);

      // 100 km * 0.621371 = 62.1371 miles for first friend
      expect(getUserPosition).toHaveBeenCalledWith(pathNodes, expect.closeTo(62.1371, 2));
      // 200 km * 0.621371 = 124.2742 miles for second friend
      expect(getUserPosition).toHaveBeenCalledWith(pathNodes, expect.closeTo(124.2742, 2));
    });

    it('calls markerScale with correct parameters (6, 2, 16)', () => {
      const nodes = createFriendMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
        onSelect,
      );

      nodes.update(sampleFriends, pathNodes, 1.5);

      expect(markerScale).toHaveBeenCalledWith(1.5, 6, 2, 16);
    });

    it('removes markers for friends no longer in the list', () => {
      const nodes = createFriendMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
        onSelect,
      );

      nodes.update(sampleFriends, pathNodes, 1.0);
      expect(nodes.markers.size).toBe(2);

      // Update with only one friend
      nodes.update([sampleFriends[0]], pathNodes, 1.0);
      expect(nodes.markers.size).toBe(1);
      expect(nodes.markers.has(1)).toBe(true);
      expect(nodes.markers.has(2)).toBe(false);
    });

    it('uses initials fallback for friends without avatar_id', () => {
      const nodes = createFriendMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
        onSelect,
      );

      const noAvatarFriends: FriendMarkerData[] = [
        { user_id: 3, username: 'gandalf', avatar_id: null, total_distance: 50 },
      ];
      nodes.update(noAvatarFriends, pathNodes, 1.0);

      // Should have created text and circle for initials
      const textWithG = textInstances.find(t => t.text === 'G');
      expect(textWithG).toBeDefined();
    });

    it('sets name attribute for test selection', () => {
      const nodes = createFriendMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
        onSelect,
      );

      const friends: FriendMarkerData[] = [
        { user_id: 42, username: 'legolas', avatar_id: null, total_distance: 300 },
      ];
      nodes.update(friends, pathNodes, 1.0);

      // The Konva.Group constructor receives name as an option
      // In our mock, the name is stored on the instance directly from options
      const friendGroup = groupInstances.find(g => {
        // name is passed as constructor option, so check the function or the raw value
        return typeof g.name === 'function'
          ? g.name() === 'friend-marker-42'
          : g.name === 'friend-marker-42';
      });
      expect(friendGroup).toBeDefined();
    });
  });

  describe('setScale', () => {
    it('applies markerScale to all marker groups', () => {
      const nodes = createFriendMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
        onSelect,
      );

      nodes.update(sampleFriends, pathNodes, 1.0);
      vi.mocked(markerScale).mockReturnValueOnce(0.75);
      nodes.setScale(2.0);

      expect(markerScale).toHaveBeenCalledWith(2.0, 6, 2, 16);
    });
  });

  describe('updateVisibility', () => {
    it('hides markers outside viewport bounds', () => {
      const nodes = createFriendMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
        onSelect,
      );

      // getUserPosition returns { x: 50, y: 25 } by default
      nodes.update(sampleFriends, pathNodes, 1.0);

      // Viewport that doesn't include the marker position
      nodes.updateVisibility({ x: 200, y: 200, width: 100, height: 100 });

      // All markers should be hidden (position 50,25 is outside 200-300, 200-300)
      for (const group of nodes.markers.values()) {
        expect(group.visible).toHaveBeenCalledWith(false);
      }
    });

    it('shows markers inside viewport bounds', () => {
      const nodes = createFriendMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
        onSelect,
      );

      // getUserPosition returns { x: 50, y: 25 } by default
      nodes.update(sampleFriends, pathNodes, 1.0);

      // Viewport that includes the marker position
      nodes.updateVisibility({ x: 0, y: 0, width: 200, height: 200 });

      for (const group of nodes.markers.values()) {
        expect(group.visible).toHaveBeenCalledWith(true);
      }
    });
  });

  describe('destroy', () => {
    it('destroys all marker groups and the layer', () => {
      const nodes = createFriendMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
        onSelect,
      );

      nodes.update(sampleFriends, pathNodes, 1.0);
      const markerGroups = [...nodes.markers.values()];

      nodes.destroy();

      expect(nodes.markers.size).toBe(0);
      for (const group of markerGroups) {
        expect(group.destroy).toHaveBeenCalled();
      }
      expect(nodes.layer.destroy).toHaveBeenCalled();
    });
  });
});
