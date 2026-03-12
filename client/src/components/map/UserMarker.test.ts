import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockNodeLike = {
  attrs: Record<string, unknown>;
  destroyed: boolean;
  x(value?: number): number | MockNodeLike;
  y(value?: number): number | MockNodeLike;
  scaleX(value?: number): number | MockNodeLike;
  scaleY(value?: number): number | MockNodeLike;
  visible(value?: boolean): boolean | MockNodeLike;
  text(value?: string): string | MockNodeLike;
};

type MockAnimationLike = {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
};

type MockBrowserImageLike = {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  crossOrigin: string | null;
  src: string;
};

const konvaMockState = vi.hoisted(() => ({
  groupInstances: [] as MockNodeLike[],
  circleInstances: [] as MockNodeLike[],
  imageInstances: [] as MockNodeLike[],
  textInstances: [] as MockNodeLike[],
  animationInstances: [] as MockAnimationLike[],
}));

vi.mock('konva', () => {
  class MockNode {
    attrs: Record<string, unknown>;
    children: MockNode[] = [];
    handlers = new Map<string, Array<(event?: unknown) => void>>();
    destroyed = false;

    constructor(options: Record<string, unknown> = {}) {
      this.attrs = { visible: true, ...options };
    }

    add(child: MockNode) {
      this.children.push(child);
      return this;
    }

    on(events: string, handler: (event?: unknown) => void) {
      for (const eventName of events.split(' ')) {
        const existing = this.handlers.get(eventName) ?? [];
        existing.push(handler);
        this.handlers.set(eventName, existing);
      }
      return this;
    }

    x(value?: number) {
      if (typeof value === 'undefined') return (this.attrs.x as number | undefined) ?? 0;
      this.attrs.x = value;
      return this;
    }

    y(value?: number) {
      if (typeof value === 'undefined') return (this.attrs.y as number | undefined) ?? 0;
      this.attrs.y = value;
      return this;
    }

    scaleX(value?: number) {
      if (typeof value === 'undefined') return (this.attrs.scaleX as number | undefined) ?? 0;
      this.attrs.scaleX = value;
      return this;
    }

    scaleY(value?: number) {
      if (typeof value === 'undefined') return (this.attrs.scaleY as number | undefined) ?? 0;
      this.attrs.scaleY = value;
      return this;
    }

    visible(value?: boolean) {
      if (typeof value === 'undefined') return this.attrs.visible !== false;
      this.attrs.visible = value;
      return this;
    }

    text(value?: string) {
      if (typeof value === 'undefined') return (this.attrs.text as string | undefined) ?? '';
      this.attrs.text = value;
      return this;
    }

    listening(value?: boolean) {
      if (typeof value === 'undefined') return this.attrs.listening === true;
      this.attrs.listening = value;
      return this;
    }

    moveToTop() {
      this.attrs.movedToTop = true;
      return this;
    }

    to(config: Record<string, unknown>) {
      if (typeof config.x === 'number') this.attrs.x = config.x;
      if (typeof config.y === 'number') this.attrs.y = config.y;
      if (typeof config.duration === 'number') this.attrs.duration = config.duration;
      if (typeof config.easing !== 'undefined') this.attrs.easing = config.easing;
      const onFinish = config.onFinish;
      if (typeof onFinish === 'function') {
        onFinish();
      }
      return this;
    }

    destroy() {
      this.destroyed = true;
    }
  }

  class MockGroup extends MockNode {
    constructor(options: Record<string, unknown> = {}) {
      super(options);
      konvaMockState.groupInstances.push(this as unknown as MockNodeLike);
    }
  }

  class MockCircle extends MockNode {
    constructor(options: Record<string, unknown> = {}) {
      super(options);
      konvaMockState.circleInstances.push(this as unknown as MockNodeLike);
    }
  }

  class MockImageNode extends MockNode {
    constructor(options: Record<string, unknown> = {}) {
      super(options);
      konvaMockState.imageInstances.push(this as unknown as MockNodeLike);
    }
  }

  class MockLabel extends MockNode {}
  class MockTag extends MockNode {}
  class MockText extends MockNode {
    constructor(options: Record<string, unknown> = {}) {
      super(options);
      konvaMockState.textInstances.push(this as unknown as MockNodeLike);
    }
  }

  class MockAnimation {
    start = vi.fn();
    stop = vi.fn();

    constructor(_callback: unknown, _layer: unknown) {
      konvaMockState.animationInstances.push(this as unknown as MockAnimationLike);
    }
  }

  return {
    default: {
      Group: MockGroup,
      Circle: MockCircle,
      Image: MockImageNode,
      Label: MockLabel,
      Tag: MockTag,
      Text: MockText,
      Animation: MockAnimation,
      Easings: {
        EaseInOut: 'EaseInOut',
        Linear: 'Linear',
      },
    },
  };
});

const browserImages: MockBrowserImageLike[] = [];

class MockBrowserImage implements MockBrowserImageLike {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin: string | null = null;
  src = '';
}

import Konva from 'konva';
import { createUserMarker } from './UserMarker';

function findCircle(predicate: (attrs: Record<string, unknown>) => boolean): MockNodeLike | undefined {
  return konvaMockState.circleInstances.find((circle) => predicate(circle.attrs));
}

function getMarkerCircle(): MockNodeLike | undefined {
  return findCircle((attrs) => attrs.fill === '#DAA520' && attrs.strokeWidth === 3);
}

function getInnerRing(): MockNodeLike | undefined {
  return findCircle((attrs) => attrs.stroke === '#B8860B');
}

describe('UserMarker', () => {
  const mockLayer = {
    add: vi.fn(),
    batchDraw: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    konvaMockState.groupInstances.length = 0;
    konvaMockState.circleInstances.length = 0;
    konvaMockState.imageInstances.length = 0;
    konvaMockState.textInstances.length = 0;
    konvaMockState.animationInstances.length = 0;
    browserImages.length = 0;

    Object.defineProperty(window, 'Image', {
      writable: true,
      value: class extends MockBrowserImage {
        constructor() {
          super();
          browserImages.push(this);
        }
      },
    });
  });

  it('renders the ring fallback and skips image loading when no avatar is set', () => {
    const marker = createUserMarker(
      mockLayer as unknown as Konva.Layer,
      { x: 120, y: 240 },
      1,
      10,
      null,
    );

    expect(browserImages).toHaveLength(0);
    expect(konvaMockState.circleInstances).toHaveLength(3);
    expect(konvaMockState.imageInstances).toHaveLength(0);
    expect(mockLayer.add).toHaveBeenCalledWith(marker.group);
  });

  it('loads and renders the avatar thumbnail when avatarId is present', () => {
    createUserMarker(
      mockLayer as unknown as Konva.Layer,
      { x: 120, y: 240 },
      1,
      10,
      'frodo',
    );

    expect(browserImages).toHaveLength(1);
    expect(browserImages[0].src).toBe('/img/avatars/thumbs/frodo.webp');
    expect(browserImages[0].crossOrigin).toBe('anonymous');

    browserImages[0].onload?.();

    expect(konvaMockState.groupInstances).toHaveLength(2);
    expect(konvaMockState.imageInstances).toHaveLength(1);
    expect(getMarkerCircle()?.visible()).toBe(false);
    expect(getInnerRing()?.visible()).toBe(false);
    expect(mockLayer.batchDraw).toHaveBeenCalled();
  });

  it('keeps the ring fallback when avatar loading fails', () => {
    createUserMarker(
      mockLayer as unknown as Konva.Layer,
      { x: 120, y: 240 },
      1,
      10,
      'samwise',
    );

    expect(browserImages).toHaveLength(1);

    browserImages[0].onerror?.();

    expect(konvaMockState.imageInstances).toHaveLength(0);
    expect(getMarkerCircle()?.visible()).toBe(true);
    expect(getInnerRing()?.visible()).toBe(true);
  });

  it('preserves the existing marker API after avatar support is added', () => {
    const marker = createUserMarker(
      mockLayer as unknown as Konva.Layer,
      { x: 10, y: 20 },
      1,
      10,
      'aragorn',
    );

    marker.setPosition({ x: 30, y: 40 });
    expect(marker.group.x()).toBe(30);
    expect(marker.group.y()).toBe(40);

    marker.setPosition({ x: 50, y: 60 }, true);
    expect(marker.group.x()).toBe(50);
    expect(marker.group.y()).toBe(60);

    marker.setScale(2);
    expect(marker.group.scaleX()).toBeGreaterThan(0);
    expect(marker.group.scaleY()).toBeGreaterThan(0);

    marker.setDistance(25);
    expect(konvaMockState.textInstances[0].text()).toBe('Current Location: 40 km');

    marker.animateAlongPoints([
      { x: 50, y: 60 },
      { x: 75, y: 90 },
    ]);
    expect(marker.group.x()).toBe(75);
    expect(marker.group.y()).toBe(90);

    marker.destroy();
    expect(konvaMockState.animationInstances[0].stop).toHaveBeenCalled();
    expect(marker.group.destroyed).toBe(true);
    expect(browserImages[0].onload).toBeNull();
    expect(browserImages[0].onerror).toBeNull();
  });

  it('ignores late avatar load callbacks after destroy', () => {
    const marker = createUserMarker(
      mockLayer as unknown as Konva.Layer,
      { x: 10, y: 20 },
      1,
      10,
      'legolas',
    );

    const lateOnload = browserImages[0].onload;

    marker.destroy();
    lateOnload?.();

    expect(konvaMockState.imageInstances).toHaveLength(0);
    expect(mockLayer.batchDraw).not.toHaveBeenCalled();
  });
});