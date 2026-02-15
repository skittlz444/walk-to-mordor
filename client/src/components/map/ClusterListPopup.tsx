/**
 * ClusterListPopup — Desktop popup showing all goals in a cluster.
 *
 * When multiple waypoints overlap and form a cluster badge, clicking it
 * shows this scrollable list so the user can pick any goal to expand.
 */

import { useSignal } from '@preact/signals';
import type { Waypoint } from '../../data/waypoints';

export interface ClusterListPopupProps {
  cluster: Waypoint[];
  position: { x: number; y: number };
  onClose: () => void;
  onExpand: (waypointId: number) => void;
}

/** Convert miles to km for display. */
const MILES_TO_KM = 1.60934;

export function ClusterListPopup({ cluster, position, onClose, onExpand }: ClusterListPopupProps) {
  return (
    <div
      class="waypoint-popup cluster-list-popup"
      style={`left:${position.x}px;top:${position.y}px;`}
      role="dialog"
      aria-label={`${cluster.length} waypoints at this location`}
      onClick={(e: Event) => e.stopPropagation()}
    >
      <button
        class="waypoint-popup-close"
        type="button"
        aria-label="Close popup"
        onClick={onClose}
      >
        ✕
      </button>
      <div class="cluster-list-header">
        <h3 class="cluster-list-title">{cluster.length} Waypoints</h3>
      </div>
      <div class="cluster-list-items">
        {cluster.map((wp) => (
          <ClusterListItem key={wp.id} waypoint={wp} onExpand={onExpand} />
        ))}
      </div>
    </div>
  );
}

function ClusterListItem({ waypoint, onExpand }: { waypoint: Waypoint; onExpand: (id: number) => void }) {
  const imgError = useSignal(false);
  const distanceKm = (waypoint.distance * MILES_TO_KM).toFixed(1);
  const thumbSrc = waypoint.image_id ? `/img/thumbs/${waypoint.image_id}-thumb.webp` : null;

  return (
    <button
      class="cluster-list-item"
      type="button"
      onClick={() => onExpand(waypoint.id)}
      aria-label={`View ${waypoint.title}`}
    >
      <div class="cluster-list-item-thumb">
        {thumbSrc && !imgError.value ? (
          <img
            src={thumbSrc}
            alt={`${waypoint.title} thumbnail`}
            loading="lazy"
            onError={() => { imgError.value = true; }}
          />
        ) : (
          <div class="waypoint-popup-thumb-placeholder" aria-hidden="true">
            <i class="fas fa-mountain"></i>
          </div>
        )}
      </div>
      <div class="cluster-list-item-info">
        <span class="cluster-list-item-title">{waypoint.title}</span>
        <span class="cluster-list-item-distance">{distanceKm} km</span>
      </div>
      <i class="fas fa-chevron-right cluster-list-item-arrow" aria-hidden="true"></i>
    </button>
  );
}
