import { render, screen, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WaypointPopup } from './WaypointPopup';
import { WaypointSheet } from './WaypointSheet';
import type { Waypoint } from '../../data/waypoints';

const baseWaypoint: Waypoint = {
  id: 42,
  distance: 26.4, // miles
  title: 'Bucklebury Ferry',
  x: 500,
  y: 300,
  special: null,
};

describe('WaypointPopup', () => {
  const mockOnClose = vi.fn();
  const mockOnExpand = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnExpand.mockClear();
  });

  it('renders waypoint title', () => {
    render(
      <WaypointPopup
        waypoint={baseWaypoint}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    expect(screen.getByText('Bucklebury Ferry')).toBeTruthy();
  });

  it('renders distance in km', () => {
    render(
      <WaypointPopup
        waypoint={baseWaypoint}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    // 26.4 miles * 1.60934 = ~42.5 km
    expect(screen.getByText('42.5 km from Bag End')).toBeTruthy();
  });

  it('renders special text only when not null', () => {
    const { rerender } = render(
      <WaypointPopup
        waypoint={baseWaypoint}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    // No special text
    expect(screen.queryByText('Some special')).toBeFalsy();

    // With special text
    const specialWaypoint = { ...baseWaypoint, special: 'The Old Forest' };
    rerender(
      <WaypointPopup
        waypoint={specialWaypoint}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    expect(screen.getByText('The Old Forest')).toBeTruthy();
  });

  it('renders thumbnail image when image_id is present', () => {
    const wpWithImage = { ...baseWaypoint, image_id: '7' } as Waypoint & { image_id: string };
    render(
      <WaypointPopup
        waypoint={wpWithImage}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    const img = screen.getByAltText('Bucklebury Ferry thumbnail') as HTMLImageElement;
    expect(img.src).toContain('/img/thumbs/7-thumb.webp');
  });

  it('renders placeholder when no image_id', () => {
    render(
      <WaypointPopup
        waypoint={baseWaypoint}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    expect(document.querySelector('.waypoint-popup-thumb-placeholder')).toBeTruthy();
  });

  it('close button calls onClose', () => {
    render(
      <WaypointPopup
        waypoint={baseWaypoint}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    const closeBtn = screen.getByLabelText('Close popup');
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('expand button calls onExpand with correct ID', () => {
    render(
      <WaypointPopup
        waypoint={baseWaypoint}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    const expandBtn = screen.getByLabelText('View full details');
    fireEvent.click(expandBtn);
    expect(mockOnExpand).toHaveBeenCalledWith(42);
  });

  it('has role dialog with aria-label', () => {
    render(
      <WaypointPopup
        waypoint={baseWaypoint}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toBe('Waypoint: Bucklebury Ferry');
  });

  it('stops propagation on internal click', () => {
    render(
      <WaypointPopup
        waypoint={baseWaypoint}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    const dialog = screen.getByRole('dialog');
    const event = new MouseEvent('click', { bubbles: true });
    const stopSpy = vi.spyOn(event, 'stopPropagation');
    dialog.dispatchEvent(event);
    expect(stopSpy).toHaveBeenCalled();
  });
});

describe('WaypointSheet', () => {
  const mockOnClose = vi.fn();
  const mockOnExpand = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnExpand.mockClear();
  });

  it('renders waypoint title', () => {
    render(
      <WaypointSheet
        waypoint={baseWaypoint}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    expect(screen.getByText('Bucklebury Ferry')).toBeTruthy();
  });

  it('renders distance in km', () => {
    render(
      <WaypointSheet
        waypoint={baseWaypoint}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    expect(screen.getByText('42.5 km from Bag End')).toBeTruthy();
  });

  it('close button calls onClose', () => {
    render(
      <WaypointSheet
        waypoint={baseWaypoint}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    const closeBtn = screen.getByLabelText('Close popup');
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('clicking overlay calls onClose', () => {
    render(
      <WaypointSheet
        waypoint={baseWaypoint}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    const overlay = document.querySelector('.waypoint-sheet-overlay') as HTMLElement;
    fireEvent.click(overlay);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('expand button calls onExpand with correct ID', () => {
    render(
      <WaypointSheet
        waypoint={baseWaypoint}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    const expandBtn = screen.getByLabelText('View full details');
    fireEvent.click(expandBtn);
    expect(mockOnExpand).toHaveBeenCalledWith(42);
  });

  it('renders special text only when present', () => {
    const specialWaypoint = { ...baseWaypoint, special: 'Rivendell' };
    render(
      <WaypointSheet
        waypoint={specialWaypoint}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    expect(screen.getByText('Rivendell')).toBeTruthy();
  });
});
