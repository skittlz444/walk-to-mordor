/**
 * WaypointSheet — Mobile bottom-sheet variant of the waypoint popup.
 *
 * Slides up from the bottom, full-width, partial-height.
 * Same content structure as the desktop WaypointPopup.
 */

import { useSignal } from '@preact/signals';
import type { Waypoint } from '../../data/waypoints';

export interface WaypointSheetProps {
  waypoint: Waypoint;
  onClose: () => void;
  onExpand: (waypointId: number) => void;
}

/** Convert miles to km for display. */
const MILES_TO_KM = 1.60934;

export function WaypointSheet({ waypoint, onClose, onExpand }: WaypointSheetProps) {
  const imgError = useSignal(false);

  const distanceKm = (waypoint.distance * MILES_TO_KM).toFixed(1);
  const imageId = (waypoint as Waypoint & { image_id?: string | null }).image_id;
  const thumbSrc = imageId ? `/img/thumbs/${imageId}-thumb.webp` : null;

  const handleImgError = () => {
    imgError.value = true;
  };

  return (
    <div
      class="waypoint-sheet-overlay"
      onClick={onClose}
    >
      <div
        class="waypoint-sheet"
        role="dialog"
        aria-label={`Waypoint: ${waypoint.title}`}
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
        <div class="waypoint-sheet-content">
          <div class="waypoint-sheet-thumb">
            {thumbSrc && !imgError.value ? (
              <img
                src={thumbSrc}
                alt={`${waypoint.title} thumbnail`}
                loading="lazy"
                onError={handleImgError}
              />
            ) : (
              <div class="waypoint-popup-thumb-placeholder" aria-hidden="true">
                <i class="fas fa-mountain"></i>
              </div>
            )}
          </div>
          <div class="waypoint-sheet-info">
            <h3 class="waypoint-popup-title">{waypoint.title}</h3>
            <p class="waypoint-popup-distance">{distanceKm} km from Bag End</p>
            {waypoint.special && (
              <p class="waypoint-popup-special">{waypoint.special}</p>
            )}
            <button
              class="waypoint-popup-expand"
              type="button"
              aria-label="View full details"
              title="View full details"
              onClick={() => onExpand(waypoint.id)}
            >
              <i class="fas fa-expand-alt" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
