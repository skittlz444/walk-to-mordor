/**
 * ClusterListSheet — Mobile bottom-sheet showing all goals in a cluster.
 *
 * Full-width, slides up from bottom, same list content as ClusterListPopup.
 */

import { useSignal } from '@preact/signals';
import type { Waypoint } from '../../data/waypoints';
import { MILES_TO_KM } from '../../utils/map-utils';

export interface ClusterListSheetProps {
  cluster: Waypoint[];
  onClose: () => void;
  onExpand: (waypointId: number) => void;
}

export function ClusterListSheet({ cluster, onClose, onExpand }: ClusterListSheetProps) {
  return (
    <div class="waypoint-sheet-overlay" onClick={onClose}>
      <div
        class="waypoint-sheet cluster-list-sheet"
        role="dialog"
        aria-label={`${cluster.length} waypoints at this location`}
        onClick={(e: Event) => e.stopPropagation()}
      >
        <div class="waypoint-sheet-handle" aria-hidden="true" />
        <button
          class="waypoint-sheet-close"
          type="button"
          aria-label="Close popup"
          onClick={onClose}
        >
          ✕
        </button>
        <div class="cluster-list-header cluster-list-header-sheet">
          <h3 class="cluster-list-title">{cluster.length} Waypoints</h3>
        </div>
        <div class="cluster-list-items">
          {cluster.map((wp) => (
            <ClusterListSheetItem key={wp.id} waypoint={wp} onExpand={onExpand} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ClusterListSheetItem({ waypoint, onExpand }: { waypoint: Waypoint; onExpand: (id: number) => void }) {
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
