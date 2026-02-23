/**
 * DistanceModalIsland — Controller island for the distance-logging modal.
 *
 * Renders an overlay + DistanceModal when progressStore.isModalOpen is true.
 * Exposes backward-compatible window globals on mount.
 */

import { useEffect, useRef } from 'preact/hooks';
import { DistanceModal } from './DistanceModal';
import {
  isModalOpen,
  currentEvent,
  currentDate,
  showDistanceModal,
  closeModal,
  saveDistance,
  deleteDistance,
  fetchTotalDistance,
  setOnWalkSaved,
  setOnDismiss,
} from '../stores/progressStore';
import type { WalkAction } from '../stores/progressStore';
import { formatDate } from '../stores/calendarStore';
import type { CalendarEvent } from '../stores/calendarStore';

// ============================================================================
// Global declarations for backward compatibility
// ============================================================================

declare global {
  interface Window {
    showDistanceModal: (
      event: CalendarEvent | undefined,
      date: Date
    ) => void;
    showProgressModal: (
      event: CalendarEvent | undefined,
      date: Date
    ) => void;
    fetchAndUpdateTotalDistance: () => Promise<void>;
    onWalkSaved: (callback: (action: WalkAction) => void) => void;
    onWalkDismiss: (callback: () => void) => void;
    progressModule: {
      showDistanceModal: (
        event: CalendarEvent | undefined,
        date: Date
      ) => void;
      fetchAndUpdateTotalDistance: () => Promise<void>;
    };
    showProfileModal?: () => void;
    profileModule?: { showProfileModal: () => void };
  }
}

// ============================================================================
// Helpers
// ============================================================================

function formatDateWithFallback(date: Date): string {
  if (window.calendarModule?.formatDate) {
    return window.calendarModule.formatDate(date);
  }
  return formatDate(date);
}

// ============================================================================
// Component
// ============================================================================

export function DistanceModalIsland() {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Expose window globals on mount
  useEffect(() => {
    const show = (
      event: CalendarEvent | undefined,
      date: Date
    ): void => {
      showDistanceModal(event, date);
    };

    window.showDistanceModal = show;
    window.showProgressModal = show;
    window.fetchAndUpdateTotalDistance = fetchTotalDistance;
    window.onWalkSaved = setOnWalkSaved;
    window.onWalkDismiss = setOnDismiss;
    window.progressModule = {
      showDistanceModal: show,
      fetchAndUpdateTotalDistance: fetchTotalDistance,
    };
  }, []);

  // ESC key handler — always-on listener, checks signal inside handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isModalOpen.value) {
        closeModal(true);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  // Auto-focus distance input when modal opens
  useEffect(() => {
    if (!isModalOpen.value) return;
    const timer = setTimeout(() => {
      const input = document.getElementById('distance-input');
      if (input) input.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [isModalOpen.value]);

  if (!isModalOpen.value) return null;

  const event = currentEvent.value;
  const date = currentDate.value;
  const isEdit = !!event;
  const selectedDate = date ? formatDateWithFallback(date) : '';
  let distanceValue = '';
  if (event?.title) {
    distanceValue = event.title.replace(/\s*km$/, '');
  }

  const handleOverlayClick = (e: MouseEvent): void => {
    if (e.target === overlayRef.current) {
      closeModal(true);
    }
  };

  return (
    <div
      class="modal-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
    >
      <DistanceModal
        selectedDate={selectedDate}
        distanceValue={distanceValue}
        isEdit={isEdit}
        onSave={(distance: number) => {
          saveDistance(distance);
        }}
        onDelete={() => {
          deleteDistance();
        }}
        onCancel={() => closeModal(true)}
      />
    </div>
  );
}
