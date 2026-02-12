import { useEffect, useRef, useCallback } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import Konva from 'konva';

const TILES_META_URL = '/img/map/tiles/metadata.json';
const SCALE_BY = 1.1;
const MAX_ZOOM = 3.0;

interface TileLevel {
  z: number;
  width: number;
  height: number;
  cols: number;
  rows: number;
}

interface TileMetadata {
  fullWidth: number;
  fullHeight: number;
  tileSize: number;
  levels: TileLevel[];
}

interface StageSize {
  width: number;
  height: number;
}

const tileImageCache = new Map<string, HTMLImageElement>();

function getContainerSize(el: HTMLElement | null): StageSize {
  if (!el) return { width: window.innerWidth, height: window.innerHeight };
  return { width: el.clientWidth, height: el.clientHeight };
}

function clampScale(s: number, minScale: number): number {
  return Math.min(MAX_ZOOM, Math.max(minScale, s));
}

function clampPosition(
  pos: { x: number; y: number },
  s: number,
  stage: StageSize,
  mapW: number,
  mapH: number,
): { x: number; y: number } {
  const scaledW = mapW * s;
  const scaledH = mapH * s;
  const minX = stage.width - scaledW;
  const minY = stage.height - scaledH;
  return {
    x: Math.min(0, Math.max(minX, pos.x)),
    y: Math.min(0, Math.max(minY, pos.y)),
  };
}

function computeMinScale(stage: StageSize, mapW: number, mapH: number): number {
  if (mapW === 0 || mapH === 0) return 0.5;
  return Math.max(stage.width / mapW, stage.height / mapH, 0.1);
}

function getTouchDistance(touches: TouchList): number {
  return Math.sqrt(
    (touches[1].clientX - touches[0].clientX) ** 2 +
    (touches[1].clientY - touches[0].clientY) ** 2,
  );
}

function getTouchCenter(touches: TouchList): { x: number; y: number } {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}

function pickLevel(levels: TileLevel[], currentScale: number, fullWidth: number): TileLevel {
  let best = levels[0];
  for (const lvl of levels) {
    const levelScale = lvl.width / fullWidth;
    if (levelScale >= currentScale * 0.7) {
      best = lvl;
    }
  }
  return best;
}

interface VisibleTile {
  key: string;
  col: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
}

function getVisibleTiles(
  level: TileLevel,
  tileSize: number,
  fullWidth: number,
  pos: { x: number; y: number },
  currentScale: number,
  stage: StageSize,
): VisibleTile[] {
  const levelScale = level.width / fullWidth;
  const levelTileInMapCoords = tileSize / levelScale;

  const vpLeft = -pos.x / currentScale;
  const vpTop = -pos.y / currentScale;
  const vpRight = vpLeft + stage.width / currentScale;
  const vpBottom = vpTop + stage.height / currentScale;

  const colStart = Math.max(0, Math.floor(vpLeft / levelTileInMapCoords));
  const colEnd = Math.min(level.cols - 1, Math.floor(vpRight / levelTileInMapCoords));
  const rowStart = Math.max(0, Math.floor(vpTop / levelTileInMapCoords));
  const rowEnd = Math.min(level.rows - 1, Math.floor(vpBottom / levelTileInMapCoords));

  const tiles: VisibleTile[] = [];
  for (let row = rowStart; row <= rowEnd; row++) {
    for (let col = colStart; col <= colEnd; col++) {
      const mapX = col * levelTileInMapCoords;
      const mapY = row * levelTileInMapCoords;
      const tileW = Math.min(tileSize, level.width - col * tileSize);
      const tileH = Math.min(tileSize, level.height - row * tileSize);
      const mapTileW = tileW / levelScale;
      const mapTileH = tileH / levelScale;

      tiles.push({
        key: `${level.z}_${col}_${row}`,
        col,
        row,
        x: mapX,
        y: mapY,
        width: mapTileW,
        height: mapTileH,
        src: `/img/map/tiles/${level.z}/${col}_${row}.webp`,
      });
    }
  }
  return tiles;
}

function loadTileImage(src: string): Promise<HTMLImageElement> {
  const cached = tileImageCache.get(src);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      tileImageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

export function MapIsland() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const lastTouchDist = useRef(0);
  const lastTouchCenter = useRef({ x: 0, y: 0 });
  const renderedTiles = useRef<Map<string, Konva.Image>>(new Map());
  const metaRef = useRef<TileMetadata | null>(null);

  const stageSize = useSignal<StageSize>({ width: 800, height: 600 });
  const currentScale = useSignal(1);
  const position = useSignal({ x: 0, y: 0 });
  const minScaleVal = useSignal(0.5);
  const loading = useSignal(true);
  const error = useSignal(false);

  const updateTiles = useCallback(() => {
    const meta = metaRef.current;
    const layer = layerRef.current;
    const stage = stageRef.current;
    if (!meta || !layer || !stage) return;

    const level = pickLevel(meta.levels, currentScale.value, meta.fullWidth);
    const visible = getVisibleTiles(
      level,
      meta.tileSize,
      meta.fullWidth,
      position.value,
      currentScale.value,
      stageSize.value,
    );

    const visibleKeys = new Set(visible.map((t) => t.key));

    // Remove tiles no longer visible
    renderedTiles.current.forEach((node, key) => {
      if (!visibleKeys.has(key)) {
        node.destroy();
        renderedTiles.current.delete(key);
      }
    });

    // Add new tiles
    for (const tile of visible) {
      if (renderedTiles.current.has(tile.key)) continue;

      const placeholder = new Konva.Rect({
        x: tile.x,
        y: tile.y,
        width: tile.width,
        height: tile.height,
        fill: '#2a2a3e',
      });
      layer.add(placeholder);

      loadTileImage(tile.src).then((img) => {
        placeholder.destroy();
        if (!layerRef.current) return;
        const konvaImg = new Konva.Image({
          image: img,
          x: tile.x,
          y: tile.y,
          width: tile.width,
          height: tile.height,
        });
        layerRef.current.add(konvaImg);
        renderedTiles.current.set(tile.key, konvaImg);
        layerRef.current.batchDraw();
      }).catch(() => {
        placeholder.destroy();
      });
    }

    layer.batchDraw();
  }, []);

  const applyTransform = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.position(position.value);
    stage.scale({ x: currentScale.value, y: currentScale.value });
    stage.batchDraw();
    updateTiles();
  }, [updateTiles]);

  // Initialize Konva stage and fetch metadata
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const size = getContainerSize(container);
    stageSize.value = size;

    const stage = new Konva.Stage({
      container,
      width: size.width,
      height: size.height,
      draggable: true,
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    stageRef.current = stage;
    layerRef.current = layer;

    // Drag bounds
    stage.dragBoundFunc((pos: { x: number; y: number }) => {
      const meta = metaRef.current;
      if (!meta) return pos;
      return clampPosition(pos, currentScale.value, stageSize.value, meta.fullWidth, meta.fullHeight);
    });

    stage.on('dragend', () => {
      const meta = metaRef.current;
      if (!meta) return;
      position.value = clampPosition(
        stage.position(),
        currentScale.value,
        stageSize.value,
        meta.fullWidth,
        meta.fullHeight,
      );
      updateTiles();
    });

    // Wheel zoom
    stage.on('wheel', (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const meta = metaRef.current;
      if (!meta) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const oldScale = currentScale.value;
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = clampScale(
        direction > 0 ? oldScale * SCALE_BY : oldScale / SCALE_BY,
        minScaleVal.value,
      );

      const mousePointTo = {
        x: (pointer.x - position.value.x) / oldScale,
        y: (pointer.y - position.value.y) / oldScale,
      };
      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };

      currentScale.value = newScale;
      position.value = clampPosition(newPos, newScale, stageSize.value, meta.fullWidth, meta.fullHeight);
      applyTransform();
    });

    // Fetch metadata
    fetch(TILES_META_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: TileMetadata) => {
        metaRef.current = data;
        const min = computeMinScale(size, data.fullWidth, data.fullHeight);
        minScaleVal.value = min;
        currentScale.value = min;

        const scaledW = data.fullWidth * min;
        const scaledH = data.fullHeight * min;
        position.value = {
          x: (size.width - scaledW) / 2,
          y: (size.height - scaledH) / 2,
        };

        loading.value = false;
        applyTransform();
      })
      .catch(() => {
        error.value = true;
        loading.value = false;
      });

    // Resize handler
    function onResize() {
      const newSize = getContainerSize(container);
      stageSize.value = newSize;
      stage.width(newSize.width);
      stage.height(newSize.height);

      const meta = metaRef.current;
      if (meta) {
        const min = computeMinScale(newSize, meta.fullWidth, meta.fullHeight);
        minScaleVal.value = min;
        const clamped = clampScale(currentScale.value, min);
        currentScale.value = clamped;
        position.value = clampPosition(position.value, clamped, newSize, meta.fullWidth, meta.fullHeight);
        applyTransform();
      }
    }
    window.addEventListener('resize', onResize);

    // Touch pinch-to-zoom
    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        lastTouchDist.current = getTouchDistance(e.touches);
        lastTouchCenter.current = getTouchCenter(e.touches);
      }
    }

    function handleTouchMove(e: TouchEvent) {
      const meta = metaRef.current;
      if (e.touches.length !== 2 || !meta || !container) return;
      e.preventDefault();

      const newDist = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches);

      if (lastTouchDist.current === 0) {
        lastTouchDist.current = newDist;
        lastTouchCenter.current = center;
        return;
      }

      const pinchRatio = newDist / lastTouchDist.current;
      const oldScale = currentScale.value;
      const newScale = clampScale(oldScale * pinchRatio, minScaleVal.value);

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

      currentScale.value = newScale;
      position.value = clampPosition(newPos, newScale, stageSize.value, meta.fullWidth, meta.fullHeight);
      applyTransform();

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
      window.removeEventListener('resize', onResize);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      stage.destroy();
      stageRef.current = null;
      layerRef.current = null;
      renderedTiles.current.clear();
    };
  }, []);

  if (error.value) {
    return <div className="map-container">Failed to load map data.</div>;
  }

  return (
    <div
      ref={containerRef}
      className="map-canvas-wrapper"
      style={{ cursor: 'grab' }}
    >
      {loading.value && (
        <div className="map-loading-overlay">Loading Middle-earth...</div>
      )}
    </div>
  );
}
