import { useEffect, useRef, useCallback } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import Konva from 'konva';
import {
  createJourneyPath,
  updateJourneyPath,
  type JourneyPathNodes,
} from '../components/map/JourneyPath';
import {
  createUserMarker,
  type UserMarkerNodes,
} from '../components/map/UserMarker';
import {
  createWaypointMarkers,
  type WaypointMarkerNodes,
} from '../components/map/WaypointMarkers';
import { WaypointPopupContainer } from '../components/map/WaypointPopupContainer';
import { GoalModal } from './GoalModal';
import { getUserPosition, MILES_TO_KM, type Point } from '../utils/map-utils';
import {
  getScreenPosition,
  getOptimalPopupPosition,
  calculatePanOffset,
} from '../utils/map-popup-utils';
import {
  readLastOpenedDistanceMiles,
  writeLastOpenedDistanceMiles,
} from '../utils/map-storage.ts';
import { fellowshipPath } from '../data/paths/fellowship-path';
import type { Goal } from '../types/goal';
import {
  getWaypointCoordinates,
  filterWaypointsByRange,
  filterWaypointsByViewport,
  filterWaypointsByTier,
  getVisibilityTier,
  type Waypoint,
} from '../data/waypoints';
import { MapWalkIsland } from './MapWalkIsland';
import { userProgress, milestones } from '../stores/mapStore';

const TILES_META_URL = '/img/map/tiles/metadata.json';
const PROGRESS_API_URL = '/api/total-distance';
const GOALS_API_URL = '/api/goals';
const KM_TO_MILES = 0.621371;
const SCALE_BY = 1.3;
const MAX_ZOOM = 3.0;
/** Default zoom level when centering on user position */
const DEFAULT_CENTER_ZOOM = 1.7;
/** Total journey distance in miles (Bag End to Bag End, all 9 challenges). */
const TOTAL_PATH_DISTANCE_MILES = 3991;
/** Fallback popup dimensions before the real rendered size is measured. */
const INITIAL_POPUP_SIZE = { width: 280, height: 200 };
/** Mobile breakpoint matching WaypointPopupContainer. */
const MOBILE_BREAKPOINT = 768;

/** Dev mode: set window.__MAP_DEV_LOG = true in console to log coordinates on click */

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
  // Fix 4: use Math.floor to ensure bottom/right edge is fully reachable
  const minX = Math.floor(stage.width - scaledW);
  const minY = Math.floor(stage.height - scaledH);
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
  // Pick the coarsest level whose resolution is still adequate for the current scale.
  // levels are sorted z=0 (full-res) to z=N (smallest).
  // We want the highest z (smallest image) where levelScale >= currentScale
  // so that each tile pixel covers at most one screen pixel.
  // Default to z=0 (full-res) when zoomed past native resolution.
  let best = levels[0];
  for (let i = levels.length - 1; i >= 0; i--) {
    const lvl = levels[i];
    const levelScale = lvl.width / fullWidth;
    if (levelScale >= currentScale) {
      best = lvl;
      break;
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

  // Small overlap in map coordinates to eliminate sub-pixel seams
  // caused by floating-point rounding during canvas scale transforms.
  const overlap = 1 / levelScale;

  const tiles: VisibleTile[] = [];
  for (let row = rowStart; row <= rowEnd; row++) {
    for (let col = colStart; col <= colEnd; col++) {
      const mapX = col * levelTileInMapCoords;
      const mapY = row * levelTileInMapCoords;
      const tileW = Math.min(tileSize, level.width - col * tileSize);
      const tileH = Math.min(tileSize, level.height - row * tileSize);
      const mapTileW = tileW / levelScale + overlap;
      const mapTileH = tileH / levelScale + overlap;

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
  const isPinching = useRef(false);
  const renderedTiles = useRef<Map<string, Konva.Image>>(new Map());
  const pendingTiles = useRef<Map<string, Konva.Rect>>(new Map());
  const currentLevelZ = useRef(-1);
  const metaRef = useRef<TileMetadata | null>(null);
  const pathLayerRef = useRef<Konva.Layer | null>(null);
  const pathNodesRef = useRef<JourneyPathNodes | null>(null);
  const markerLayerRef = useRef<Konva.Layer | null>(null);
  const markerRef = useRef<UserMarkerNodes | null>(null);
  const waypointMarkersRef = useRef<WaypointMarkerNodes | null>(null);
  const allWaypointsRef = useRef<Waypoint[]>([]);
  const allGoalsRef = useRef<Goal[]>([]);
  const isUserPanning = useRef(false);
  const panAnimRef = useRef<Konva.Animation | null>(null);

  const stageSize = useSignal<StageSize>({ width: 800, height: 600 });
  const currentScale = useSignal(1);
  const position = useSignal({ x: 0, y: 0 });
  const minScaleVal = useSignal(0.5);
  const loading = useSignal(true);
  const error = useSignal(false);
  // User's walked distance in miles, fetched from /api/progress on init.
  const userDistance = useSignal(0);

  // Popup state signals
  const selectedWaypoint = useSignal<Waypoint | null>(null);
  const selectedCluster = useSignal<Waypoint[]>([]);
  const popupPosition = useSignal<{ x: number; y: number } | null>(null);
  const measuredPopupSize = useSignal<{ width: number; height: number } | null>(null);
  const isMobile = useSignal(false);
  const expandGoal = useSignal<Goal | null>(null);

  /** Close the waypoint popup. */
  const closePopup = useCallback(() => {
    selectedWaypoint.value = null;
    selectedCluster.value = [];
    popupPosition.value = null;
    measuredPopupSize.value = null;
  }, []);

  /** Open the full goal detail modal for a waypoint. */
  const handleExpandWaypoint = useCallback((waypointId: number) => {
    const goal = allGoalsRef.current.find((g) => g.id === waypointId) ?? null;
    expandGoal.value = goal;
    closePopup();
  }, [closePopup]);

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
    const isFirstRender = currentLevelZ.current === -1;
    const levelChanged = !isFirstRender && level.z !== currentLevelZ.current;
    currentLevelZ.current = level.z;

    // When the level changes, keep old tiles until new ones load.
    // Only remove tiles that belong to the NEW level and are off-screen.
    // Old-level tiles are kept as a backdrop.
    const oldTilesToRemove: string[] = [];
    renderedTiles.current.forEach((_node, key) => {
      const tileZ = parseInt(key.split('_')[0], 10);
      if (tileZ === level.z && !visibleKeys.has(key)) {
        // Same level, no longer visible — remove
        oldTilesToRemove.push(key);
      }
    });
    for (const key of oldTilesToRemove) {
      const node = renderedTiles.current.get(key);
      if (node) {
        node.destroy();
        renderedTiles.current.delete(key);
      }
    }

    // Also clean up pending placeholders that are no longer needed
    pendingTiles.current.forEach((placeholder, key) => {
      if (!visibleKeys.has(key)) {
        placeholder.destroy();
        pendingTiles.current.delete(key);
      }
    });

    // Count how many tiles we need to load for the current level
    let tilesNeeded = 0;
    let tilesLoaded = 0;

    // Add new tiles for the current level
    for (const tile of visible) {
      if (renderedTiles.current.has(tile.key) || pendingTiles.current.has(tile.key)) {
        if (renderedTiles.current.has(tile.key)) tilesLoaded++;
        tilesNeeded++;
        continue;
      }
      tilesNeeded++;

      // Use a transparent placeholder (no dark flash) — old tiles show through
      const placeholder = new Konva.Rect({
        x: tile.x,
        y: tile.y,
        width: tile.width,
        height: tile.height,
        fill: 'transparent',
      });
      layer.add(placeholder);
      pendingTiles.current.set(tile.key, placeholder);

      loadTileImage(tile.src).then((img) => {
        // Remove the placeholder
        const ph = pendingTiles.current.get(tile.key);
        if (ph) {
          ph.destroy();
          pendingTiles.current.delete(tile.key);
        }
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

        // Check if all tiles for the current level are now loaded;
        // if so, clean up old-level tiles that were kept as backdrop.
        if (levelChanged && pendingTiles.current.size === 0) {
          cleanupOldLevelTiles(level.z);
        }

        layerRef.current.batchDraw();
      }).catch(() => {
        const ph = pendingTiles.current.get(tile.key);
        if (ph) {
          ph.destroy();
          pendingTiles.current.delete(tile.key);
        }
      });
    }

    // If all tiles for the new level are already cached, remove old-level tiles now
    if (levelChanged && tilesLoaded === tilesNeeded && tilesNeeded > 0) {
      cleanupOldLevelTiles(level.z);
    }

    layer.batchDraw();
  }, []);

  /** Remove all rendered tiles that don't belong to the given zoom level */
  const cleanupOldLevelTiles = useCallback((keepZ: number) => {
    const toRemove: string[] = [];
    renderedTiles.current.forEach((_node, key) => {
      const tileZ = parseInt(key.split('_')[0], 10);
      if (tileZ !== keepZ) {
        toRemove.push(key);
      }
    });
    for (const key of toRemove) {
      const node = renderedTiles.current.get(key);
      if (node) {
        node.destroy();
        renderedTiles.current.delete(key);
      }
    }
  }, []);

  /** Compute filtered waypoints and the next-waypoint ID for the current state. */
  const computeVisibleWaypoints = useCallback(() => {
    const devMode = !!window.__MAP_DEV_LOG;
    const scale = currentScale.value;
    const pos = position.value;
    const size = stageSize.value;

    // Determine the true "next" waypoint from the FULL list (not filtered)
    // so it stays consistent regardless of zoom/viewport filtering
    let nextWaypointId: number | null = null;
    for (const wp of allWaypointsRef.current) {
      if (wp.distance > userDistance.value) {
        nextWaypointId = wp.id;
        break;
      }
    }

    // Viewport bounds in map coordinates
    const viewport = {
      left: -pos.x / scale,
      top: -pos.y / scale,
      right: (-pos.x + size.width) / scale,
      bottom: (-pos.y + size.height) / scale,
    };

    // 1. Filter by range (7% ahead, or all in dev mode)
    let visible = filterWaypointsByRange(
      allWaypointsRef.current,
      userDistance.value,
      TOTAL_PATH_DISTANCE_MILES,
      devMode,
    );

    // 2. Filter by zoom-based visibility tier
    const tier = getVisibilityTier(scale);
    visible = filterWaypointsByTier(visible, tier);

    // 3. Filter by viewport
    visible = filterWaypointsByViewport(visible, viewport);

    return { visible, nextWaypointId, scale };
  }, []);

  /** Full rebuild of waypoint markers (used for zoom / distance changes). */
  const updateWaypointVisibility = useCallback(() => {
    if (!waypointMarkersRef.current || allWaypointsRef.current.length === 0) return;
    const { visible, nextWaypointId, scale } = computeVisibleWaypoints();
    waypointMarkersRef.current.update(visible, userDistance.value, scale, nextWaypointId);
  }, [computeVisibleWaypoints]);

  /**
   * Incremental viewport patch (used during pan / drag).
   * Only rebuilds markers when the set of visible waypoints actually changes,
   * avoiding unnecessary Konva node destruction on every drag frame.
   */
  const patchWaypointViewport = useCallback(() => {
    if (!waypointMarkersRef.current || allWaypointsRef.current.length === 0) return;
    const { visible, nextWaypointId, scale } = computeVisibleWaypoints();
    waypointMarkersRef.current.patchViewport(visible, userDistance.value, scale, nextWaypointId);
  }, [computeVisibleWaypoints]);

  const applyTransform = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.position(position.value);
    stage.scale({ x: currentScale.value, y: currentScale.value });
    stage.batchDraw();
    updateTiles();

    // Update journey path stroke widths for current zoom
    if (pathNodesRef.current) {
      updateJourneyPath(pathNodesRef.current, userDistance.value, currentScale.value);
      pathLayerRef.current?.batchDraw();
    }

    // Update marker inverse scale for zoom independence
    if (markerRef.current) {
      markerRef.current.setScale(currentScale.value);
      markerLayerRef.current?.batchDraw();
    }

    // Update waypoint markers (visibility tier + viewport culling)
    if (waypointMarkersRef.current && allWaypointsRef.current.length > 0) {
      updateWaypointVisibility();
    }
  }, [updateTiles]);

  const handleDesktopPopupSizeChange = useCallback((size: { width: number; height: number } | null) => {
    const prev = measuredPopupSize.value;
    if (!size) {
      if (prev !== null) {
        measuredPopupSize.value = null;
      }
      return;
    }

    if (prev && prev.width === size.width && prev.height === size.height) {
      return;
    }

    measuredPopupSize.value = size;

    const waypoint = selectedWaypoint.value;
    if (!waypoint || isMobile.value) {
      return;
    }

    const viewportSize = {
      width: stageSize.value.width,
      height: stageSize.value.height,
    };

    const currentScreenPos = getScreenPosition(
      waypoint,
      position.value,
      currentScale.value,
    );

    const panDelta = calculatePanOffset(
      currentScreenPos,
      size,
      viewportSize,
      false,
    );

    if (panDelta) {
      const meta = metaRef.current;
      if (meta) {
        position.value = clampPosition(
          {
            x: position.value.x + panDelta.dx,
            y: position.value.y + panDelta.dy,
          },
          currentScale.value,
          stageSize.value,
          meta.fullWidth,
          meta.fullHeight,
        );
        applyTransform();
      }
    }

    const finalScreenPos = getScreenPosition(
      waypoint,
      position.value,
      currentScale.value,
    );
    const popupPos = getOptimalPopupPosition(
      finalScreenPos,
      size,
      viewportSize,
    );
    popupPosition.value = { x: popupPos.x, y: popupPos.y };
  }, [applyTransform]);

  /**
   * Center the map on a given map coordinate at a given zoom level.
   * Respects map boundaries (edge clamping).
   * If animate is true, smoothly transitions to the new position.
   */
  const centerOnPosition = useCallback((
    mapPoint: Point,
    zoom: number,
    animate = false,
  ) => {
    const meta = metaRef.current;
    const stage = stageRef.current;
    if (!meta || !stage) return;

    const targetScale = clampScale(zoom, minScaleVal.value);
    const size = stageSize.value;

    // Calculate stage position so mapPoint is at center of viewport
    const rawPos = {
      x: size.width / 2 - mapPoint.x * targetScale,
      y: size.height / 2 - mapPoint.y * targetScale,
    };
    const targetPos = clampPosition(rawPos, targetScale, size, meta.fullWidth, meta.fullHeight);

    if (animate) {
      // Animate stage position and scale
      const startScale = currentScale.value;
      const startPos = { ...position.value };
      const duration = 0.6; // seconds
      const anim = new Konva.Animation((frame) => {
        if (!frame) return;
        const t = Math.min(frame.time / (duration * 1000), 1);
        // Ease in-out
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        const s = startScale + (targetScale - startScale) * ease;
        const p = {
          x: startPos.x + (targetPos.x - startPos.x) * ease,
          y: startPos.y + (targetPos.y - startPos.y) * ease,
        };

        currentScale.value = s;
        position.value = p;
        applyTransform();

        if (t >= 1) {
          anim.stop();
        }
      }, stage.getLayers()[0]);
      anim.start();
    } else {
      currentScale.value = targetScale;
      position.value = targetPos;
      applyTransform();
    }
  }, [applyTransform]);

  /** Handle zoom in/out from UI buttons */
  const handleZoom = useCallback((direction: 1 | -1) => {
    const meta = metaRef.current;
    if (!meta) return;
    const size = stageSize.value;

    const oldScale = currentScale.value;
    const newScale = clampScale(
      direction > 0 ? oldScale * SCALE_BY : oldScale / SCALE_BY,
      minScaleVal.value,
    );

    // Zoom toward center of viewport
    const centerX = size.width / 2;
    const centerY = size.height / 2;
    const mousePointTo = {
      x: (centerX - position.value.x) / oldScale,
      y: (centerY - position.value.y) / oldScale,
    };
    const newPos = {
      x: centerX - mousePointTo.x * newScale,
      y: centerY - mousePointTo.y * newScale,
    };

    currentScale.value = newScale;
    position.value = clampPosition(newPos, newScale, stageSize.value, meta.fullWidth, meta.fullHeight);
    applyTransform();
  }, [applyTransform]);

  /** Re-center on the user's current position */
  const handleRecenter = useCallback(() => {
    const pos = getUserPosition(fellowshipPath, userDistance.value);
    centerOnPosition(pos, DEFAULT_CENTER_ZOOM, true);
  }, [centerOnPosition]);

  /**
   * Update the user's distance and animate the marker + path.
   * Called when distance changes (e.g. from distance logging on the map page).
   * Exposed on window for external callers.
   */
  const updateUserDistance = useCallback((newDistanceMiles: number) => {
    const oldDistance = userDistance.value;
    if (newDistanceMiles === oldDistance) return;

    userDistance.value = newDistanceMiles;
    const newPos = getUserPosition(fellowshipPath, newDistanceMiles);

    // Update path
    if (pathNodesRef.current) {
      updateJourneyPath(pathNodesRef.current, newDistanceMiles, currentScale.value);
      pathLayerRef.current?.batchDraw();
    }

    // Update marker
    if (markerRef.current) {
      markerRef.current.setDistance(newDistanceMiles);
      markerRef.current.setPosition(newPos, true);
      markerLayerRef.current?.batchDraw();
    }

    // Update waypoint markers for new distance
    if (waypointMarkersRef.current) {
      updateWaypointVisibility();
    }

    // Center on new position
    centerOnPosition(newPos, currentScale.value, true);

    // Persist latest opened distance for next map visit animation baseline
    writeLastOpenedDistanceMiles(localStorage, newDistanceMiles);
  }, [centerOnPosition]);

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

    // Separate layer for the journey path (renders on top of tiles)
    const pathLayer = new Konva.Layer({ listening: false });
    stage.add(pathLayer);

    // Marker layer (renders on top of path, below UI controls)
    const markerLayer = new Konva.Layer();
    stage.add(markerLayer);

    stageRef.current = stage;
    layerRef.current = layer;
    pathLayerRef.current = pathLayer;
    markerLayerRef.current = markerLayer;

    // Dev tool: log map coordinates on click when enabled
    // Enable in browser console: window.__MAP_DEV_LOG = true
    stage.on('click tap', () => {
      if (!window.__MAP_DEV_LOG) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const mapX = Math.round((pointer.x - position.value.x) / currentScale.value);
      const mapY = Math.round((pointer.y - position.value.y) / currentScale.value);
      console.log(`[MapDev] Click at map coordinates: { x: ${mapX}, y: ${mapY} }`);
    });

    // Drag bounds
    stage.dragBoundFunc((pos: { x: number; y: number }) => {
      const meta = metaRef.current;
      if (!meta) return pos;
      return clampPosition(pos, currentScale.value, stageSize.value, meta.fullWidth, meta.fullHeight);
    });

    // Close popup on user-initiated drag (pan)
    stage.on('dragstart', () => {
      isUserPanning.current = true;
      closePopup();
    });

    // Fix 3 part A: during drag, update position and tiles
    stage.on('dragmove', () => {
      const meta = metaRef.current;
      if (!meta) {
        position.value = stage.position();
      } else {
        position.value = clampPosition(
          stage.position(),
          currentScale.value,
          stageSize.value,
          meta.fullWidth,
          meta.fullHeight,
        );
      }
      updateTiles();

      // Incrementally patch waypoint markers during pan (avoids full rebuild per frame)
      if (waypointMarkersRef.current && allWaypointsRef.current.length > 0) {
        patchWaypointViewport();
      }
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

      // Final full waypoint update after drag completes
      if (waypointMarkersRef.current && allWaypointsRef.current.length > 0) {
        updateWaypointVisibility();
      }
      isUserPanning.current = false;
    });

    // Wheel zoom — close popup on user zoom
    stage.on('wheel', (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      closePopup();
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

    // Fetch metadata and user progress in parallel
    const metaPromise = fetch(TILES_META_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<TileMetadata>;
      });

    const token = localStorage.getItem('sessionToken');
    const progressPromise = token
      ? fetch(PROGRESS_API_URL, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => (res.ok ? res.json() : { totalDistance: 0 }))
          .then((data: { totalDistance: number }) => data.totalDistance * KM_TO_MILES)
          .catch(() => 0)
      : Promise.resolve(0);

    const goalsPromise = token
      ? fetch(GOALS_API_URL, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => (res.ok ? (res.json() as Promise<Goal[]>) : []))
          .catch(() => [] as Goal[])
      : Promise.resolve([] as Goal[]);

    Promise.all([metaPromise, progressPromise, goalsPromise])
      .then(([data, distMiles, goals]) => {
        metaRef.current = data;

        const previousOpenedDistance = readLastOpenedDistanceMiles(localStorage);
        const hasPreviousOpenedDistance = previousOpenedDistance !== null;
        const initialDistance = hasPreviousOpenedDistance
          ? previousOpenedDistance
          : distMiles;

        userDistance.value = initialDistance;

        // Populate mapStore userProgress for MapWalkIsland to use
        userProgress.value = {
          totalDistance: distMiles * MILES_TO_KM,
          lastUpdated: new Date(),
        };

        const min = computeMinScale(size, data.fullWidth, data.fullHeight);
        minScaleVal.value = min;

        // Determine user position for initial centering
        const userPos = getUserPosition(fellowshipPath, initialDistance);

        // Start zoomed in on user position
        const initialZoom = clampScale(DEFAULT_CENTER_ZOOM, min);
        currentScale.value = initialZoom;

        // Center viewport on user position, clamped to map bounds
        const rawPos = {
          x: size.width / 2 - userPos.x * initialZoom,
          y: size.height / 2 - userPos.y * initialZoom,
        };
        position.value = clampPosition(rawPos, initialZoom, size, data.fullWidth, data.fullHeight);

        loading.value = false;

        // Create journey path on the path layer
        pathNodesRef.current = createJourneyPath(
          pathLayer,
          userDistance.value,
          initialZoom,
        );

        // Create user marker on marker layer
        markerRef.current = createUserMarker(
          markerLayer,
          userPos,
          initialZoom,
          initialDistance,
        );

        // Create waypoint markers from goals data
        if (goals.length > 0) {
          const waypoints = getWaypointCoordinates(fellowshipPath, goals);
          allWaypointsRef.current = waypoints;
          allGoalsRef.current = goals;

          // Populate mapStore milestones for MapWalkIsland to use
          milestones.value = waypoints.map((wp, idx) => ({
            ...goals[idx],
            x: wp.x,
            y: wp.y,
          }));

          // Initial waypoint markers (empty - will be populated by updateWaypointVisibility)
          waypointMarkersRef.current = createWaypointMarkers(
            markerLayer,
            [],
            initialDistance,
            initialZoom,
            (wp, cluster) => {
              // Calculate screen position of waypoint
              const screenPos = getScreenPosition(
                wp,
                position.value,
                currentScale.value,
              );
              const viewportSize = {
                width: stageSize.value.width,
                height: stageSize.value.height,
              };
              const mobile = viewportSize.width <= MOBILE_BREAKPOINT;
              isMobile.value = mobile;
              measuredPopupSize.value = null;

              const popupSize = measuredPopupSize.value ?? INITIAL_POPUP_SIZE;

              // Calculate pan offset if needed
              const panDelta = calculatePanOffset(
                screenPos,
                popupSize,
                viewportSize,
                mobile,
              );

              if (panDelta) {
                // Animate the stage pan
                const meta = metaRef.current;
                if (meta) {
                  const newPos = clampPosition(
                    {
                      x: position.value.x + panDelta.dx,
                      y: position.value.y + panDelta.dy,
                    },
                    currentScale.value,
                    stageSize.value,
                    meta.fullWidth,
                    meta.fullHeight,
                  );

                  // Stop any running pan animation before starting a new one
                  if (panAnimRef.current) {
                    panAnimRef.current.stop();
                    panAnimRef.current = null;
                  }

                  // Animate pan with Konva
                  const startPos = { ...position.value };
                  const duration = 0.3;
                  const anim = new Konva.Animation((frame) => {
                    if (!frame) return;
                    const t = Math.min(frame.time / (duration * 1000), 1);
                    // easeInOutQuad: smooth acceleration then deceleration
                    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                    position.value = {
                      x: startPos.x + (newPos.x - startPos.x) * ease,
                      y: startPos.y + (newPos.y - startPos.y) * ease,
                    };
                    applyTransform();

                    if (t >= 1) {
                      anim.stop();
                      panAnimRef.current = null;
                      // Update popup position after pan completes
                      const finalScreenPos = getScreenPosition(
                        wp,
                        position.value,
                        currentScale.value,
                      );
                      const popupPos = getOptimalPopupPosition(
                        finalScreenPos,
                        popupSize,
                        viewportSize,
                      );
                      selectedWaypoint.value = wp;
                      selectedCluster.value = cluster ?? [];
                      popupPosition.value = { x: popupPos.x, y: popupPos.y };
                    }
                  }, stage.getLayers()[0]);
                  panAnimRef.current = anim;
                  anim.start();
                }
              } else {
                // No pan needed — show popup immediately
                const popupPos = getOptimalPopupPosition(
                  screenPos,
                  popupSize,
                  viewportSize,
                );
                selectedWaypoint.value = wp;
                selectedCluster.value = cluster ?? [];
                popupPosition.value = { x: popupPos.x, y: popupPos.y };
              }
            },
          );
        }

        applyTransform();

        // Smoothly transition on initial load from previous opened distance to latest distance
        if (hasPreviousOpenedDistance && previousOpenedDistance !== distMiles) {
          updateUserDistance(distMiles);
        } else {
          writeLastOpenedDistanceMiles(localStorage, distMiles);
        }

        // Expose updateUserDistance on window for external callers
        (window as Window & { updateMapDistance?: (d: number) => void }).updateMapDistance = (newDistKm: number) => {
          updateUserDistance(newDistKm * KM_TO_MILES);
        };
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

    // Fix 3: Touch pinch-to-zoom with Konva drag suppression
    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        // Disable Konva's built-in drag during pinch to prevent drift
        isPinching.current = true;
        stage.draggable(false);
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
      // Fix 3: use the MIDPOINT between the two touches relative to container
      const pinchCenterX = center.x - rect.left;
      const pinchCenterY = center.y - rect.top;

      // Also handle two-finger pan: track how the pinch center moved
      const prevCenterX = lastTouchCenter.current.x - rect.left;
      const prevCenterY = lastTouchCenter.current.y - rect.top;
      const panDeltaX = pinchCenterX - prevCenterX;
      const panDeltaY = pinchCenterY - prevCenterY;

      // Zoom toward pinch center
      const mousePointTo = {
        x: (pinchCenterX - position.value.x) / oldScale,
        y: (pinchCenterY - position.value.y) / oldScale,
      };
      const newPos = {
        x: pinchCenterX - mousePointTo.x * newScale + panDeltaX,
        y: pinchCenterY - mousePointTo.y * newScale + panDeltaY,
      };

      currentScale.value = newScale;
      position.value = clampPosition(newPos, newScale, stageSize.value, meta.fullWidth, meta.fullHeight);
      applyTransform();

      lastTouchDist.current = newDist;
      lastTouchCenter.current = center;
    }

    function handleTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2 && isPinching.current) {
        isPinching.current = false;
        // Re-enable dragging after pinch ends
        stage.draggable(true);
        lastTouchDist.current = 0;
      }
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('resize', onResize);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      if (markerRef.current) {
        markerRef.current.destroy();
        markerRef.current = null;
      }
      if (waypointMarkersRef.current) {
        waypointMarkersRef.current.destroy();
        waypointMarkersRef.current = null;
      }
      allWaypointsRef.current = [];
      allGoalsRef.current = [];
      stage.destroy();
      stageRef.current = null;
      layerRef.current = null;
      pathLayerRef.current = null;
      markerLayerRef.current = null;
      pathNodesRef.current = null;
      renderedTiles.current.clear();
      pendingTiles.current.clear();
      delete (window as Window & { updateMapDistance?: unknown }).updateMapDistance;
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
      {!loading.value && (
        <div className="map-controls">
          <button
            type="button"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={() => handleZoom(1)}
          >
            <i className="fas fa-plus" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={() => handleZoom(-1)}
          >
            <i className="fas fa-minus" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            aria-label="Re-center on current location"
            title="Re-center"
            onClick={handleRecenter}
          >
            <i className="fas fa-crosshairs" aria-hidden="true"></i>
          </button>
        </div>
      )}
      {/* Waypoint detail popup (HTML overlay, outside Konva canvas) */}
      <WaypointPopupContainer
        selectedWaypoint={selectedWaypoint}
        selectedCluster={selectedCluster}
        popupPosition={popupPosition}
        onClose={closePopup}
        onExpand={handleExpandWaypoint}
        isMobile={isMobile}
        onDesktopPopupSizeChange={handleDesktopPopupSizeChange}
      />
      {/* Full goal detail modal (opened from popup expand button) */}
      {expandGoal.value && (
        <GoalModal
          goal={expandGoal.value}
          currentDistance={userDistance.value * MILES_TO_KM}
          onClose={() => { expandGoal.value = null; }}
        />
      )}
      {/* Walk logging FAB and congratulations flow (Story 2.8) */}
      {!loading.value && (
        <MapWalkIsland currentDistanceKm={userDistance.value * MILES_TO_KM} />
      )}
    </div>
  );
}
