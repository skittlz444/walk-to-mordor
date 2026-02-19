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

/** Walking person SVG icon */
const WalkIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    width="24"
    height="24"
    aria-hidden="true"
  >
    <circle cx="12" cy="4" r="2" />
    <path d="M14 7h-4l-1 5l3 3l-1 5h2l1-5l-2-2l1-3h1l1-3z" />
    <path d="M10.5 12L9 22h2l1-6l-1.5-4z" />
    <path d="M13.5 12l1.5 4l1 6h2l-2-10h-2.5z" />
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
