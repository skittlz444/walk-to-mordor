import { useEffect, useRef, useCallback, useState } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { Stage, Layer, Image } from 'react-konva';
import type Konva from 'konva';

const MAP_PRIMARY = '/img/map/ctd58g7fsmyf1.webp';
const MAP_FALLBACK = '/img/map/8K_Middle_Earth_by_Kerem_Yurtseven.webp';
const SCALE_BY = 1.1;
const MAX_ZOOM = 3.0;
const MAX_TEXTURE_SIZE = 8192;

type ImageStatus = 'loading' | 'loaded' | 'failed';

function useMapImage(): [HTMLImageElement | undefined, ImageStatus] {
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);
  const [status, setStatus] = useState<ImageStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    function tryLoad(src: string, isFallback: boolean) {
      const img = new window.Image();
      img.onload = () => {
        if (cancelled) return;
        if (!isFallback && (img.naturalWidth > MAX_TEXTURE_SIZE || img.naturalHeight > MAX_TEXTURE_SIZE)) {
          tryLoad(MAP_FALLBACK, true);
          return;
        }
        setImage(img);
        setStatus('loaded');
      };
      img.onerror = () => {
        if (cancelled) return;
        if (!isFallback) {
          tryLoad(MAP_FALLBACK, true);
        } else {
          setStatus('failed');
        }
      };
      img.src = src;
    }

    tryLoad(MAP_PRIMARY, false);

    return () => { cancelled = true; };
  }, []);

  return [image, status];
}

interface StageSize {
  width: number;
  height: number;
}

function getContainerSize(el: HTMLElement | null): StageSize {
  if (!el) return { width: window.innerWidth, height: window.innerHeight };
  return { width: el.clientWidth, height: el.clientHeight };
}

function clampScale(scale: number, minScale: number): number {
  return Math.min(MAX_ZOOM, Math.max(minScale, scale));
}

function clampPosition(
  pos: { x: number; y: number },
  scale: number,
  stageSize: StageSize,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number } {
  const scaledW = imageWidth * scale;
  const scaledH = imageHeight * scale;
  const minX = stageSize.width - scaledW;
  const minY = stageSize.height - scaledH;
  return {
    x: Math.min(0, Math.max(minX, pos.x)),
    y: Math.min(0, Math.max(minY, pos.y)),
  };
}

function computeMinScale(stageSize: StageSize, imgW: number, imgH: number): number {
  if (imgW === 0 || imgH === 0) return 0.5;
  return Math.max(stageSize.width / imgW, stageSize.height / imgH, 0.1);
}

function getTouchDistance(touches: TouchList): number {
  const t0 = touches[0];
  const t1 = touches[1];
  return Math.sqrt(
    (t1.clientX - t0.clientX) ** 2 + (t1.clientY - t0.clientY) ** 2,
  );
}

function getTouchCenter(touches: TouchList): { x: number; y: number } {
  const t0 = touches[0];
  const t1 = touches[1];
  return {
    x: (t0.clientX + t1.clientX) / 2,
    y: (t0.clientY + t1.clientY) / 2,
  };
}

export function MapIsland() {
  const [mapImage, imageStatus] = useMapImage();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const lastTouchDist = useRef<number>(0);
  const lastTouchCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const stageSize = useSignal<StageSize>({ width: 800, height: 600 });
  const scale = useSignal(1);
  const position = useSignal({ x: 0, y: 0 });
  const minScale = useSignal(0.5);

  const imgW = mapImage?.naturalWidth ?? 0;
  const imgH = mapImage?.naturalHeight ?? 0;

  // Calculate min scale and set initial position/scale when image loads
  useEffect(() => {
    if (imageStatus !== 'loaded' || imgW === 0 || imgH === 0) return;
    const size = getContainerSize(containerRef.current);
    stageSize.value = size;
    const min = computeMinScale(size, imgW, imgH);
    minScale.value = min;
    const initialScale = min;
    scale.value = initialScale;
    // Center the map
    const scaledW = imgW * initialScale;
    const scaledH = imgH * initialScale;
    position.value = {
      x: (size.width - scaledW) / 2,
      y: (size.height - scaledH) / 2,
    };
  }, [imageStatus, imgW, imgH]);

  // Handle window resize
  useEffect(() => {
    function onResize() {
      const size = getContainerSize(containerRef.current);
      stageSize.value = size;
      if (imgW > 0 && imgH > 0) {
        const min = computeMinScale(size, imgW, imgH);
        minScale.value = min;
        const newScale = clampScale(scale.value, min);
        scale.value = newScale;
        position.value = clampPosition(position.value, newScale, size, imgW, imgH);
      }
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [imgW, imgH]);

  // Initial container measurement
  useEffect(() => {
    if (containerRef.current) {
      stageSize.value = getContainerSize(containerRef.current);
    }
  }, []);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      if (imgW === 0 || imgH === 0) return;
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const oldScale = scale.value;
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = clampScale(
        direction > 0 ? oldScale * SCALE_BY : oldScale / SCALE_BY,
        minScale.value,
      );

      const mousePointTo = {
        x: (pointer.x - position.value.x) / oldScale,
        y: (pointer.y - position.value.y) / oldScale,
      };

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };

      scale.value = newScale;
      position.value = clampPosition(newPos, newScale, stageSize.value, imgW, imgH);
    },
    [imgW, imgH],
  );

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (imgW === 0 || imgH === 0) return;
      const node = e.target;
      position.value = clampPosition(
        { x: node.x(), y: node.y() },
        scale.value,
        stageSize.value,
        imgW,
        imgH,
      );
    },
    [imgW, imgH],
  );

  const dragBoundFunc = useCallback(
    (pos: { x: number; y: number }) => {
      if (imgW === 0 || imgH === 0) return pos;
      return clampPosition(pos, scale.value, stageSize.value, imgW, imgH);
    },
    [imgW, imgH],
  );

  // Touch pinch-to-zoom (attached to the native container)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        lastTouchDist.current = getTouchDistance(e.touches);
        lastTouchCenter.current = getTouchCenter(e.touches);
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (e.touches.length !== 2 || imgW === 0 || imgH === 0 || !container) return;
      e.preventDefault();

      const newDist = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches);

      if (lastTouchDist.current === 0) {
        lastTouchDist.current = newDist;
        lastTouchCenter.current = center;
        return;
      }

      const pinchRatio = newDist / lastTouchDist.current;
      const oldScale = scale.value;
      const newScale = clampScale(oldScale * pinchRatio, minScale.value);

      // Get the position relative to the container
      const rect = container.getBoundingClientRect();
      const pointerX = center.x - rect.left;
      const pointerY = center.y - rect.top;

      const mousePointTo = {
        x: (pointerX - position.value.x) / oldScale,
        y: (pointerY - position.value.y) / oldScale,
      };

      const newPos = {
        x: pointerX - mousePointTo.x * newScale,
        y: pointerY - mousePointTo.y * newScale,
      };

      scale.value = newScale;
      position.value = clampPosition(newPos, newScale, stageSize.value, imgW, imgH);

      lastTouchDist.current = newDist;
      lastTouchCenter.current = center;
    }

    function handleTouchEnd() {
      lastTouchDist.current = 0;
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [imgW, imgH]);

  if (imageStatus === 'loading') {
    return <div className="map-container">Loading Middle-earth...</div>;
  }

  if (imageStatus === 'failed') {
    return <div className="map-container">Failed to load map image.</div>;
  }

  return (
    <div ref={containerRef} className="map-canvas-wrapper" style={{ cursor: 'grab' }}>
      <Stage
        ref={stageRef}
        width={stageSize.value.width}
        height={stageSize.value.height}
        x={position.value.x}
        y={position.value.y}
        scaleX={scale.value}
        scaleY={scale.value}
        draggable
        dragBoundFunc={dragBoundFunc}
        onDragEnd={handleDragEnd}
        onWheel={handleWheel}
      >
        <Layer>
          <Image image={mapImage} />
        </Layer>
      </Stage>
    </div>
  );
}
