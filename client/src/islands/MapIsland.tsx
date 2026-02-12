import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Group, Image as KonvaImage, Layer, Stage } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Image as KonvaImageNode } from 'konva/lib/shapes/Image';
import type { Stage as KonvaStage } from 'konva/lib/Stage';

const MAP_IMAGE_SRC = '/img/map/ctd58g7fsmyf1.webp';
const FALLBACK_IMAGE_SRC = '/img/map/8K_Middle_Earth_by_Kerem_Yurtseven.webp';
const MIN_BASE_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_BY = 1.1;

type Vector2d = {
  x: number;
  y: number;
};

type Size = {
  width: number;
  height: number;
};

function useMapImage() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    const mapImage = new window.Image();

    function handleLoad() {
      if (isMounted) {
        setImage(mapImage);
      }
    }

    function handleError() {
      if (mapImage.src !== FALLBACK_IMAGE_SRC) {
        mapImage.src = FALLBACK_IMAGE_SRC;
        return;
      }
      if (isMounted) {
        setImage(null);
      }
    }

    mapImage.addEventListener('load', handleLoad);
    mapImage.addEventListener('error', handleError);
    mapImage.src = MAP_IMAGE_SRC;

    return () => {
      isMounted = false;
      mapImage.removeEventListener('load', handleLoad);
      mapImage.removeEventListener('error', handleError);
    };
  }, []);

  return image;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getBounds(scale: number, stageSize: Size, mapSize: Size) {
  const mapWidth = mapSize.width * scale;
  const mapHeight = mapSize.height * scale;

  if (!stageSize.width || !stageSize.height || !mapWidth || !mapHeight) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    };
  }

  if (mapWidth <= stageSize.width) {
    const centeredX = (stageSize.width - mapWidth) / 2;
    const centeredY = mapHeight <= stageSize.height ? (stageSize.height - mapHeight) / 2 : 0;

    return {
      minX: centeredX,
      maxX: centeredX,
      minY: mapHeight <= stageSize.height ? centeredY : stageSize.height - mapHeight,
      maxY: mapHeight <= stageSize.height ? centeredY : 0,
    };
  }

  const minX = stageSize.width - mapWidth;
  const minY = stageSize.height - mapHeight;

  return {
    minX,
    maxX: 0,
    minY,
    maxY: 0,
  };
}

function clampPosition(position: Vector2d, scale: number, stageSize: Size, mapSize: Size) {
  const bounds = getBounds(scale, stageSize, mapSize);

  return {
    x: clamp(position.x, bounds.minX, bounds.maxX),
    y: clamp(position.y, bounds.minY, bounds.maxY),
  };
}

function getCenterPosition(scale: number, stageSize: Size, mapSize: Size) {
  const mapWidth = mapSize.width * scale;
  const mapHeight = mapSize.height * scale;

  if (!stageSize.width || !stageSize.height || !mapWidth || !mapHeight) {
    return { x: 0, y: 0 };
  }

  return {
    x: (stageSize.width - mapWidth) / 2,
    y: (stageSize.height - mapHeight) / 2,
  };
}

function getTouchCenter(touch1: Touch, touch2: Touch) {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  };
}

function getTouchDistance(touch1: Touch, touch2: Touch) {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.hypot(dx, dy);
}

export function MapIsland() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<KonvaStage | null>(null);
  const imageRef = useRef<KonvaImageNode | null>(null);
  const pinchDistanceRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const mapImage = useMapImage();

  const [stageSize, setStageSize] = useState<Size>({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState<Vector2d>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const mapSize = useMemo(
    () => ({
      width: mapImage?.width ?? 0,
      height: mapImage?.height ?? 0,
    }),
    [mapImage],
  );

  const minScale = useMemo(() => {
    if (!mapSize.width || !mapSize.height || !stageSize.width || !stageSize.height) {
      return MIN_BASE_SCALE;
    }
    const fitScale = Math.min(stageSize.width / mapSize.width, stageSize.height / mapSize.height);
    return Math.max(MIN_BASE_SCALE, fitScale);
  }, [mapSize, stageSize]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    function updateSize() {
      setStageSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    }

    container.style.touchAction = 'none';
    updateSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!mapImage || !stageSize.width || !stageSize.height) {
      return;
    }

    if (!initializedRef.current) {
      setScale(minScale);
      setPosition(getCenterPosition(minScale, stageSize, mapSize));
      initializedRef.current = true;
      return;
    }

    const nextScale = clamp(scale, minScale, MAX_SCALE);
    if (nextScale !== scale) {
      setScale(nextScale);
    }

    setPosition((prev) => clampPosition(prev, nextScale, stageSize, mapSize));
  }, [mapImage, mapSize, minScale, scale, stageSize]);

  useEffect(() => {
    if (!mapImage || !imageRef.current) {
      return;
    }
    imageRef.current.cache();
    imageRef.current.getLayer()?.batchDraw();
  }, [mapImage]);

  const handleWheel = useCallback(
    (event: KonvaEventObject<WheelEvent>) => {
      event.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      const pointer = stage.getPointerPosition();
      if (!pointer) {
        return;
      }

      const oldScale = scale;
      const direction = event.evt.deltaY > 0 ? -1 : 1;
      const updatedScale = direction > 0 ? oldScale * SCALE_BY : oldScale / SCALE_BY;
      const newScale = clamp(updatedScale, minScale, MAX_SCALE);
      const mousePointTo = {
        x: (pointer.x - position.x) / oldScale,
        y: (pointer.y - position.y) / oldScale,
      };
      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };

      setScale(newScale);
      setPosition(clampPosition(newPos, newScale, stageSize, mapSize));
    },
    [mapSize, minScale, position, scale, stageSize],
  );

  const handleTouchMove = useCallback(
    (event: KonvaEventObject<TouchEvent>) => {
      const { touches } = event.evt;
      if (!touches || touches.length < 2) {
        return;
      }

      event.evt.preventDefault();

      const stage = stageRef.current;
      if (!stage) {
        return;
      }

      const [touch1, touch2] = Array.from(touches);
      const dist = getTouchDistance(touch1, touch2);
      const lastDist = pinchDistanceRef.current;

      if (!lastDist) {
        pinchDistanceRef.current = dist;
        return;
      }

      const center = getTouchCenter(touch1, touch2);
      const newScale = clamp(scale * (dist / lastDist), minScale, MAX_SCALE);
      const pointTo = {
        x: (center.x - position.x) / scale,
        y: (center.y - position.y) / scale,
      };
      const newPos = {
        x: center.x - pointTo.x * newScale,
        y: center.y - pointTo.y * newScale,
      };

      pinchDistanceRef.current = dist;
      setScale(newScale);
      setPosition(clampPosition(newPos, newScale, stageSize, mapSize));
    },
    [mapSize, minScale, position, scale, stageSize],
  );

  const handleTouchEnd = useCallback(() => {
    pinchDistanceRef.current = null;
  }, []);

  const dragBoundFunc = useCallback(
    (pos: Vector2d) => clampPosition(pos, scale, stageSize, mapSize),
    [mapSize, scale, stageSize],
  );

  const handleDragMove = useCallback((event: KonvaEventObject<DragEvent>) => {
    setPosition({
      x: event.target.x(),
      y: event.target.y(),
    });
  }, []);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback((event: KonvaEventObject<DragEvent>) => {
    setIsDragging(false);
    setPosition({
      x: event.target.x(),
      y: event.target.y(),
    });
  }, []);

  const shouldRenderStage = mapImage && stageSize.width > 0 && stageSize.height > 0;

  return (
    <div
      className={`map-container${isDragging ? ' is-dragging' : ''}`}
      ref={containerRef}
      data-map-ready={mapImage ? 'true' : 'false'}
      data-map-scale={scale.toFixed(3)}
      data-map-x={Math.round(position.x)}
      data-map-y={Math.round(position.y)}
    >
      {shouldRenderStage ? (
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          onWheel={handleWheel}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          ref={stageRef}
        >
          <Layer>
            <Group
              x={position.x}
              y={position.y}
              scaleX={scale}
              scaleY={scale}
              draggable
              dragBoundFunc={dragBoundFunc}
              onDragMove={handleDragMove}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <KonvaImage
                ref={imageRef}
                image={mapImage}
                width={mapSize.width}
                height={mapSize.height}
                listening={false}
                perfectDrawEnabled={false}
              />
            </Group>
          </Layer>
        </Stage>
      ) : (
        <span>Loading Middle-earth...</span>
      )}
    </div>
  );
}
