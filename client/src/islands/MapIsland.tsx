import { useEffect, useRef, useState } from 'preact/hooks';
import { Image as KonvaImage, Layer, Stage } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Stage as KonvaStage } from 'konva/lib/Stage';
import type { Vector2d } from 'konva/lib/types';

type Dimensions = { width: number; height: number };
type Position = { x: number; y: number };

// Preferred base map asset (per product decision)
const MAP_IMAGE_SRC = '/img/map/ctd58g7fsmyf1.webp';
const MAP_FALLBACK_SRC = '/img/map/8K_Middle_Earth_by_Kerem_Yurtseven.webp';
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const SCALE_BY = 1.1;

function clampScale(scale: number, minScale: number) {
  return Math.min(MAX_ZOOM, Math.max(minScale, scale));
}

function clampPosition(pos: Vector2d, scale: number, dims: Dimensions, image: HTMLImageElement): Vector2d {
  const scaledWidth = image.width * scale;
  const scaledHeight = image.height * scale;
  const minX = Math.min(0, dims.width - scaledWidth);
  const minY = Math.min(0, dims.height - scaledHeight);

  return {
    x: Math.max(minX, Math.min(pos.x, 0)),
    y: Math.max(minY, Math.min(pos.y, 0)),
  };
}

function getFitScale(dims: Dimensions, image: HTMLImageElement) {
  if (!dims.width || !dims.height) {
    return MIN_ZOOM;
  }
  const fitScale = Math.max(dims.width / image.width, dims.height / image.height);
  return Math.max(MIN_ZOOM, fitScale);
}

function getStagePoint(stage: KonvaStage, clientX: number, clientY: number) {
  const rect = stage.container().getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

type MapDebug = {
  getState: () => { scale: number; position: Position; minScale: number };
};

export function MapIsland() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<KonvaStage | null>(null);
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [minScale, setMinScale] = useState(MIN_ZOOM);
  const scaleRef = useRef(scale);
  const positionRef = useRef(position);
  const [isDragging, setIsDragging] = useState(false);
  const pinchDistanceRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const primary = new window.Image();
    primary.src = MAP_IMAGE_SRC;
    primary.onload = () => {
      if (!cancelled) {
        setMapImage(primary);
      }
    };
    primary.onerror = () => {
      const fallback = new window.Image();
      fallback.src = MAP_FALLBACK_SRC;
      fallback.onload = () => {
        if (!cancelled) {
          setMapImage(fallback);
        }
      };
    };

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      const { width, height } = entry.contentRect;
      setDimensions({ width, height });
    });

    resizeObserver.observe(container);
    const rect = container.getBoundingClientRect();
    setDimensions({ width: rect.width, height: rect.height });

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!mapImage || !dimensions.width || !dimensions.height) {
      return;
    }

    const computedMinScale = getFitScale(dimensions, mapImage);
    const nextMinScale = Math.max(MIN_ZOOM, computedMinScale);
    const currentScale = scaleRef.current;
    const currentPosition = positionRef.current;
    const nextScale = clampScale(initializedRef.current ? Math.max(currentScale, nextMinScale) : nextMinScale, nextMinScale);
    const initialPosition: Position = initializedRef.current
      ? clampPosition(currentPosition, nextScale, dimensions, mapImage)
      : clampPosition(
          {
            x: (dimensions.width - mapImage.width * nextScale) / 2,
            y: (dimensions.height - mapImage.height * nextScale) / 2,
          },
          nextScale,
          dimensions,
          mapImage,
        );

    setMinScale(nextMinScale);
    setScale(nextScale);
    setPosition(initialPosition);
    if (!initializedRef.current) {
      initializedRef.current = true;
    }
  }, [mapImage, dimensions.width, dimensions.height]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    const globalWindow = window as typeof window & { __mapDebug?: MapDebug };
    globalWindow.__mapDebug = {
      getState: () => ({ scale, position, minScale }),
    };

    return () => {
      delete globalWindow.__mapDebug;
    };
  }, [scale, position, minScale]);

  const handleWheel = (event: KonvaEventObject<WheelEvent>) => {
    if (!mapImage) {
      return;
    }
    event.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }

    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const proposedScale = direction > 0 ? scale * SCALE_BY : scale / SCALE_BY;
    const nextScale = clampScale(proposedScale, minScale);

    const mousePointTo = {
      x: (pointer.x - position.x) / scale,
      y: (pointer.y - position.y) / scale,
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * nextScale,
      y: pointer.y - mousePointTo.y * nextScale,
    };

    const boundedPos = clampPosition(newPos, nextScale, dimensions, mapImage);
    setScale(nextScale);
    setPosition(boundedPos);
  };

  const handlePinch = (event: KonvaEventObject<TouchEvent>) => {
    if (!mapImage) {
      return;
    }

    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const touches = event.evt.touches;
    if (!touches || touches.length !== 2) {
      pinchDistanceRef.current = null;
      return;
    }

    event.evt.preventDefault();

    const dist = Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const centerX = (touches[0].clientX + touches[1].clientX) / 2;
    const centerY = (touches[0].clientY + touches[1].clientY) / 2;

    if (!pinchDistanceRef.current) {
      pinchDistanceRef.current = dist;
      return;
    }

    const scaleDelta = dist / pinchDistanceRef.current;
    const proposedScale = scale * scaleDelta;
    const nextScale = clampScale(proposedScale, minScale);
    const { x, y } = getStagePoint(stage, centerX, centerY);
    const mapPoint = {
      x: (x - position.x) / scale,
      y: (y - position.y) / scale,
    };
    const newPos = {
      x: x - mapPoint.x * nextScale,
      y: y - mapPoint.y * nextScale,
    };

    setScale(nextScale);
    setPosition(clampPosition(newPos, nextScale, dimensions, mapImage));
    pinchDistanceRef.current = dist;
  };

  const stageWidth = Math.max(1, dimensions.width);
  const stageHeight = Math.max(1, dimensions.height);

  return (
    <div className="map-container" ref={containerRef}>
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        className="map-stage"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onTouchMove={handlePinch}
        onTouchEnd={() => {
          pinchDistanceRef.current = null;
        }}
      >
        <Layer
          draggable={Boolean(mapImage)}
          dragBoundFunc={(pos) => (mapImage ? clampPosition(pos, scale, dimensions, mapImage) : pos)}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={(dragEvent) => {
            setIsDragging(false);
            setPosition({ x: dragEvent.target.x(), y: dragEvent.target.y() });
          }}
          scaleX={scale}
          scaleY={scale}
          x={position.x}
          y={position.y}
        >
          <KonvaImage image={mapImage || undefined} listening={false} />
        </Layer>
      </Stage>
      {!mapImage && <div className="map-loading">Loading Middle-earth...</div>}
    </div>
  );
}
