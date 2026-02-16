/**
 * WaypointPopup — Desktop positioned popup showing waypoint details.
 *
 * Renders as an HTML overlay (NOT Konva) for accessibility and CSS styling.
 * Shows: title, distance, special text (if any), thumbnail, expand button.
 * Does NOT show description — that is deferred to the full GoalModal.
 */

import { useSignal } from '@preact/signals';
import type { Waypoint } from '../../data/waypoints';
import { MILES_TO_KM } from '../../utils/map-utils';

export interface WaypointPopupProps {
  waypoint: Waypoint;
  position: { x: number; y: number };
  onClose: () => void;
  onExpand: (waypointId: number) => void;
  popupRef?: (el: HTMLDivElement | null) => void;
}

export function WaypointPopup({
  waypoint,
  position,
  onClose,
  onExpand,
  popupRef,
}: WaypointPopupProps) {
  const imgError = useSignal(false);

  const distanceKm = (waypoint.distance * MILES_TO_KM).toFixed(1);
  const thumbSrc = waypoint.image_id ? `/img/thumbs/${waypoint.image_id}-thumb.webp` : null;

  const handleImgError = () => {
    imgError.value = true;
  };

  return (
    <div
      ref={popupRef}
      class="waypoint-popup"
      style={`left:${position.x}px;top:${position.y}px;`}
      role="dialog"
      aria-label={`Waypoint: ${waypoint.title}`}
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
      <div class="waypoint-popup-content">
        <div class="waypoint-popup-thumb">
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
        <div class="waypoint-popup-info">
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
  );
}
