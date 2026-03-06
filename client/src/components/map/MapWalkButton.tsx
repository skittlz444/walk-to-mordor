/**
 * MapWalkButton - Floating Action Button for logging walks from the Map view.
 *
 * A touch-friendly FAB that allows users to log walk distances directly
 * from the map without navigating away.
 *
 * @see Story 2.8 - Map Walk Logging
 */

import { h } from 'preact';
import './MapWalkButton.css';

/**
 * Icon type for the FAB button
 */
export type MapWalkButtonIcon = 'walk' | 'calendar' | 'plus';

export interface MapWalkButtonProps {
  /** Callback when button is clicked */
  onClick: () => void;
  /** Icon to display. Default: 'walk' */
  icon?: MapWalkButtonIcon;
  /** Additional CSS class names */
  className?: string;
}

/** Walking person SVG icon (Material Design style) */
const WalkIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    width="24"
    height="24"
    aria-hidden="true"
  >
    <circle cx="13.5" cy="3.5" r="2" />
    <path d="M9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" />
  </svg>
);

/** Calendar SVG icon */
const CalendarIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    width="24"
    height="24"
    aria-hidden="true"
  >
    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
  </svg>
);

/** Plus/Add SVG icon */
const PlusIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    width="24"
    height="24"
    aria-hidden="true"
  >
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
  </svg>
);

/** Map icon type to component */
const iconComponents: Record<MapWalkButtonIcon, () => h.JSX.Element> = {
  walk: WalkIcon,
  calendar: CalendarIcon,
  plus: PlusIcon,
};

/**
 * Floating Action Button for logging walks from the Map view.
 *
 * Features:
 * - Touch-friendly size (≥48px diameter on mobile)
 * - Accessible with aria-label
 * - Multiple icon options: walk (default), calendar, plus
 * - Consistent styling with map controls
 */
export function MapWalkButton({
  onClick,
  icon = 'walk',
  className = '',
}: MapWalkButtonProps): h.JSX.Element {
  const IconComponent = iconComponents[icon];

  return (
    <button
      type="button"
      className={`map-walk-button ${className}`.trim()}
      onClick={onClick}
      aria-label="Log a walk"
    >
      <IconComponent />
    </button>
  );
}
