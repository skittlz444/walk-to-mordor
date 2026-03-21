import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track created instances
const groupInstances: Array<Record<string, unknown>> = [];
const circleInstances: Array<Record<string, unknown>> = [];
const rectInstances: Array<Record<string, unknown>> = [];
const textInstances: Array<Record<string, unknown>> = [];
const labelInstances: Array<Record<string, unknown>> = [];
const tagInstances: Array<Record<string, unknown>> = [];
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
      getLayer: vi.fn(() => ({ batchDraw: vi.fn() })),
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

  function MockRect(options: Record<string, unknown>) {
    const instance = {
      ...options,
      visible: vi.fn(),
      destroy: vi.fn(),
    };
    rectInstances.push(instance);
    return instance;
  }
  MockRect.prototype = {};

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

  function MockLabel(options: Record<string, unknown>) {
    const instance = {
      ...options,
      add: vi.fn(),
      visible: vi.fn(),
      destroy: vi.fn(),
    };
    labelInstances.push(instance);
    return instance;
  }
  MockLabel.prototype = {};

  function MockTag(options: Record<string, unknown>) {
    const instance = { ...options, destroy: vi.fn() };
    tagInstances.push(instance);
    return instance;
  }
  MockTag.prototype = {};

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

  return {
    default: {
      Group: MockGroup,
      Circle: MockCircle,
      Rect: MockRect,
      Text: MockText,
      Label: MockLabel,
      Tag: MockTag,
      Layer: MockLayer,
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
import { createFellowshipMarkers, type FellowshipMarkerData } from '../FellowshipMarkers';
import { getUserPosition, markerScale } from '../../../utils/map-utils';

describe('FellowshipMarkers', () => {
  let mockStage: {
    add: ReturnType<typeof vi.fn>;
    getLayers: ReturnType<typeof vi.fn>;
  };
  let mockMarkerLayer: {
    moveToTop: ReturnType<typeof vi.fn>;
  };

  const sampleFellowships: FellowshipMarkerData[] = [
    { party_id: 1, name: 'Fellowship of the Ring', total_distance: 100 },
    { party_id: 2, name: 'The Shire Walkers', total_distance: 200 },
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
    rectInstances.length = 0;
    textInstances.length = 0;
    labelInstances.length = 0;
    tagInstances.length = 0;
    layerInstances.length = 0;

    mockStage = {
      add: vi.fn(),
      getLayers: vi.fn(() => []),
    };
    mockMarkerLayer = {
      moveToTop: vi.fn(),
    };
  });

  describe('createFellowshipMarkers', () => {
    it('creates a new Konva.Layer and adds it to the stage', () => {
      const nodes = createFellowshipMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
      );

      expect(mockStage.add).toHaveBeenCalledTimes(1);
      expect(nodes.layer).toBeDefined();
    });

    it('ensures marker layer is on top (fellowship layer below user marker)', () => {
      createFellowshipMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
      );

      expect(mockMarkerLayer.moveToTop).toHaveBeenCalled();
    });

    it('starts with an empty markers map', () => {
      const nodes = createFellowshipMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
      );

      expect(nodes.markers.size).toBe(0);
    });
  });

  describe('update', () => {
    it('creates marker groups for each fellowship', () => {
      const nodes = createFellowshipMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
      );

      nodes.update(sampleFellowships, pathNodes, 1.0);

      expect(nodes.markers.size).toBe(2);
      expect(nodes.markers.has(1)).toBe(true);
      expect(nodes.markers.has(2)).toBe(true);
    });

    it('calls getUserPosition with distance converted to miles', () => {
      const nodes = createFellowshipMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
      );

      nodes.update(sampleFellowships, pathNodes, 1.0);

      // 100 km * 0.621371 = 62.1371 miles for first fellowship
      expect(getUserPosition).toHaveBeenCalledWith(pathNodes, expect.closeTo(62.1371, 2));
      // 200 km * 0.621371 = 124.2742 miles for second fellowship
      expect(getUserPosition).toHaveBeenCalledWith(pathNodes, expect.closeTo(124.2742, 2));
    });

    it('calls markerScale with correct parameters (6, 2, 18)', () => {
      const nodes = createFellowshipMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
      );

      nodes.update(sampleFellowships, pathNodes, 1.5);

      expect(markerScale).toHaveBeenCalledWith(1.5, 6, 2, 18);
    });

    it('removes markers for fellowships no longer in the list', () => {
      const nodes = createFellowshipMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
      );

      nodes.update(sampleFellowships, pathNodes, 1.0);
      expect(nodes.markers.size).toBe(2);

      // Update with only one fellowship
      nodes.update([sampleFellowships[0]], pathNodes, 1.0);
      expect(nodes.markers.size).toBe(1);
      expect(nodes.markers.has(1)).toBe(true);
      expect(nodes.markers.has(2)).toBe(false);
    });

    it('renders group icon elements (circles and rects for people silhouettes)', () => {
      const nodes = createFellowshipMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
      );

      nodes.update([sampleFellowships[0]], pathNodes, 1.0);

      // Should have created circles for the group icon (bg + people heads + border)
      expect(circleInstances.length).toBeGreaterThan(0);
      // Should have created rects for people body shapes
      expect(rectInstances.length).toBeGreaterThan(0);
    });

    it('sets name attribute for test selection', () => {
      const nodes = createFellowshipMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
      );

      const fellowships: FellowshipMarkerData[] = [
        { party_id: 42, name: 'Test Fellowship', total_distance: 300 },
      ];
      nodes.update(fellowships, pathNodes, 1.0);

      const fellowshipGroup = groupInstances.find(g => {
        return typeof g.name === 'function'
          ? g.name() === 'fellowship-marker-42'
          : g.name === 'fellowship-marker-42';
      });
      expect(fellowshipGroup).toBeDefined();
    });

    it('creates tooltip with fellowship name and distance', () => {
      const nodes = createFellowshipMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
      );

      nodes.update([{ party_id: 1, name: 'Test Party', total_distance: 100 }], pathNodes, 1.0);

      // Tooltip text should include fellowship name and distance in km
      const tooltipText = textInstances.find(t =>
        typeof t.text === 'string' && t.text.includes('Test Party')
      );
      expect(tooltipText).toBeDefined();
    });
  });

  describe('setScale', () => {
    it('applies markerScale to all marker groups', () => {
      const nodes = createFellowshipMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
      );

      nodes.update(sampleFellowships, pathNodes, 1.0);
      vi.mocked(markerScale).mockReturnValueOnce(0.75);
      nodes.setScale(2.0);

      expect(markerScale).toHaveBeenCalledWith(2.0, 6, 2, 18);
    });
  });

  describe('updateVisibility', () => {
    it('hides markers outside viewport bounds', () => {
      const nodes = createFellowshipMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
      );

      // getUserPosition returns { x: 50, y: 25 } by default
      nodes.update(sampleFellowships, pathNodes, 1.0);

      // Viewport that doesn't include the marker position
      nodes.updateVisibility({ x: 200, y: 200, width: 100, height: 100 });

      // All markers should be hidden (position 50,25 is outside 200-300, 200-300)
      for (const group of nodes.markers.values()) {
        expect(group.visible).toHaveBeenCalledWith(false);
      }
    });

    it('shows markers inside viewport bounds', () => {
      const nodes = createFellowshipMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
      );

      // getUserPosition returns { x: 50, y: 25 } by default
      nodes.update(sampleFellowships, pathNodes, 1.0);

      // Viewport that includes the marker position
      nodes.updateVisibility({ x: 0, y: 0, width: 200, height: 200 });

      for (const group of nodes.markers.values()) {
        expect(group.visible).toHaveBeenCalledWith(true);
      }
    });
  });

  describe('destroy', () => {
    it('destroys all marker groups and the layer', () => {
      const nodes = createFellowshipMarkers(
        mockStage as unknown as Konva.Stage,
        mockMarkerLayer as unknown as Konva.Layer,
      );

      nodes.update(sampleFellowships, pathNodes, 1.0);
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
