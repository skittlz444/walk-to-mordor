/**
 * WaypointPopupContainer — Controller that orchestrates popup display.
 *
 * Subscribes to waypoint selection signals, determines mobile vs desktop,
 * renders the appropriate popup variant, and handles dismissal logic
 * (ESC key, click-outside).
 *
 * For clustered waypoints (multiple overlapping goals), renders a list view
 * instead of a single-goal popup so the user can pick which goal to expand.
 */

import { useCallback, useEffect, useRef } from 'preact/hooks';
import { type Signal, type ReadonlySignal } from '@preact/signals';
import type { Waypoint } from '../../data/waypoints';
import { WaypointPopup } from './WaypointPopup';
import { WaypointSheet } from './WaypointSheet';
import { ClusterListPopup } from './ClusterListPopup';
import { ClusterListSheet } from './ClusterListSheet';
// Import CSS as inline string — Vite's ?inline query returns raw text
// so we can inject it ourselves (the HTML is server-rendered, not Vite-managed).
import popupStyles from './WaypointPopup.css?inline';

/** Breakpoint for mobile bottom sheet (matches existing map.css). */
const MOBILE_BREAKPOINT = 768;

export interface WaypointPopupContainerProps {
  selectedWaypoint: ReadonlySignal<Waypoint | null>;
  selectedCluster: ReadonlySignal<Waypoint[]>;
  popupPosition: ReadonlySignal<{ x: number; y: number } | null>;
  onClose: () => void;
  onExpand: (waypointId: number) => void;
  isMobile: Signal<boolean>;
  onDesktopPopupSizeChange?: (size: { width: number; height: number } | null) => void;
}

export function WaypointPopupContainer({
  selectedWaypoint,
  selectedCluster,
  popupPosition,
  onClose,
  onExpand,
  isMobile,
  onDesktopPopupSizeChange,
}: WaypointPopupContainerProps) {
  const waypoint = selectedWaypoint.value;
  const cluster = selectedCluster.value;
  const pos = popupPosition.value;
  const styleInjected = useRef(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const clearPopupObserver = useCallback(() => {
    if (!resizeObserverRef.current) return;
    resizeObserverRef.current.disconnect();
    resizeObserverRef.current = null;
  }, []);

  const reportPopupSize = useCallback((el: HTMLDivElement | null) => {
    if (!el || !onDesktopPopupSizeChange) return;
    const rect = el.getBoundingClientRect();
    onDesktopPopupSizeChange({
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
    });
  }, [onDesktopPopupSizeChange]);

  const popupRef = useCallback((el: HTMLDivElement | null) => {
    clearPopupObserver();

    if (!el || isMobile.value || !onDesktopPopupSizeChange) {
      return;
    }

    reportPopupSize(el);

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      reportPopupSize(el);
    });
    observer.observe(el);
    resizeObserverRef.current = observer;
  }, [clearPopupObserver, isMobile.value, onDesktopPopupSizeChange, reportPopupSize]);

  // Inject popup CSS once (server-rendered HTML doesn't load Vite CSS assets)
  useEffect(() => {
    if (styleInjected.current) return;
    styleInjected.current = true;
    const style = document.createElement('style');
    style.setAttribute('data-waypoint-popup', '');
    style.textContent = popupStyles;
    document.head.appendChild(style);
  }, []);

  // ESC key handler
  useEffect(() => {
    if (!waypoint) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [waypoint, onClose]);

  useEffect(() => {
    if (!onDesktopPopupSizeChange) return;
    if (!waypoint || isMobile.value || !pos) {
      onDesktopPopupSizeChange(null);
      clearPopupObserver();
    }
  }, [clearPopupObserver, isMobile.value, onDesktopPopupSizeChange, pos, waypoint]);

  useEffect(() => {
    return () => {
      clearPopupObserver();
    };
  }, [clearPopupObserver]);

  if (!waypoint) return null;

  // Determine if this is a cluster (multiple waypoints) or single
  const isCluster = cluster.length > 1;

  if (isMobile.value) {
    if (isCluster) {
      return (
        <ClusterListSheet
          cluster={cluster}
          onClose={onClose}
          onExpand={onExpand}
        />
      );
    }
    return (
      <WaypointSheet
        waypoint={waypoint}
        onClose={onClose}
        onExpand={onExpand}
      />
    );
  }

  if (!pos) return null;

  if (isCluster) {
    return (
      <ClusterListPopup
        cluster={cluster}
        position={pos}
        onClose={onClose}
        onExpand={onExpand}
        popupRef={popupRef}
      />
    );
  }

  return (
    <WaypointPopup
      waypoint={waypoint}
      position={pos}
      onClose={onClose}
      onExpand={onExpand}
      popupRef={popupRef}
    />
  );
}
