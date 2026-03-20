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
  image_id: null,
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

  // --- Story 9.1: Locked Milestone Card Previews ---

  it('locked=true applies blur filter to thumbnail', () => {
    const wpWithImage = { ...baseWaypoint, image_id: '7' } as Waypoint & { image_id: string };
    render(
      <WaypointPopup
        waypoint={wpWithImage}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        locked={true}
      />,
    );
    const img = screen.getByAltText('Bucklebury Ferry thumbnail') as HTMLImageElement;
    expect(img.style.filter).toContain('blur(8px)');
    expect(img.style.filter).toContain('brightness(0.6)');
  });

  it('locked=true expand button still works', () => {
    render(
      <WaypointPopup
        waypoint={baseWaypoint}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        locked={true}
      />,
    );
    const expandBtn = screen.getByLabelText('View full details');
    fireEvent.click(expandBtn);
    expect(mockOnExpand).toHaveBeenCalledWith(42);
  });

  it('locked=false (default) no blur on thumbnail', () => {
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
    const style = img.getAttribute('style') || '';
    expect(style).not.toContain('blur');
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

  // --- Story 9.1: Locked Milestone Card Previews ---

  it('locked=true applies blur filter to thumbnail', () => {
    const wpWithImage = { ...baseWaypoint, image_id: '7' } as Waypoint & { image_id: string };
    render(
      <WaypointSheet
        waypoint={wpWithImage}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        locked={true}
      />,
    );
    const img = screen.getByAltText('Bucklebury Ferry thumbnail') as HTMLImageElement;
    expect(img.style.filter).toContain('blur(8px)');
    expect(img.style.filter).toContain('brightness(0.6)');
  });

  it('locked=false (default) no blur on sheet thumbnail', () => {
    const wpWithImage = { ...baseWaypoint, image_id: '7' } as Waypoint & { image_id: string };
    render(
      <WaypointSheet
        waypoint={wpWithImage}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    const img = screen.getByAltText('Bucklebury Ferry thumbnail') as HTMLImageElement;
    const style = img.getAttribute('style') || '';
    expect(style).not.toContain('blur');
  });
});

// --- Cluster List Tests ---

import { ClusterListPopup } from './ClusterListPopup';
import { ClusterListSheet } from './ClusterListSheet';

const clusterWaypoints: Waypoint[] = [
  { id: 1, distance: 0, title: 'Bag End', x: 100, y: 100, special: null, image_id: '1' },
  { id: 2, distance: 3.1, title: 'The Water Bridge', x: 105, y: 105, special: 'First river crossing', image_id: '2' },
  { id: 3, distance: 6.2, title: 'Green Hill Country', x: 110, y: 110, special: null, image_id: null },
];

describe('ClusterListPopup', () => {
  const mockOnClose = vi.fn();
  const mockOnExpand = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnExpand.mockClear();
  });

  it('renders all waypoints in the cluster', () => {
    render(
      <ClusterListPopup
        cluster={clusterWaypoints}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    expect(screen.getByText('Bag End')).toBeTruthy();
    expect(screen.getByText('The Water Bridge')).toBeTruthy();
    expect(screen.getByText('Green Hill Country')).toBeTruthy();
  });

  it('shows cluster count in header', () => {
    render(
      <ClusterListPopup
        cluster={clusterWaypoints}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    expect(screen.getByText('3 Waypoints')).toBeTruthy();
  });

  it('clicking a list item calls onExpand with correct ID', () => {
    render(
      <ClusterListPopup
        cluster={clusterWaypoints}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    const item = screen.getByLabelText('View The Water Bridge');
    fireEvent.click(item);
    expect(mockOnExpand).toHaveBeenCalledWith(2);
  });

  it('close button calls onClose', () => {
    render(
      <ClusterListPopup
        cluster={clusterWaypoints}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    const closeBtn = screen.getByLabelText('Close popup');
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('renders thumbnail images for items with image_id', () => {
    render(
      <ClusterListPopup
        cluster={clusterWaypoints}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    const img = screen.getByAltText('Bag End thumbnail') as HTMLImageElement;
    expect(img.src).toContain('/img/thumbs/1-thumb.webp');
  });

  it('renders placeholder for items without image_id', () => {
    render(
      <ClusterListPopup
        cluster={clusterWaypoints}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    // Green Hill Country has no image_id
    const placeholders = document.querySelectorAll('.waypoint-popup-thumb-placeholder');
    expect(placeholders.length).toBeGreaterThanOrEqual(1);
  });

  it('has role dialog with aria-label', () => {
    render(
      <ClusterListPopup
        cluster={clusterWaypoints}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toBe('3 waypoints at this location');
  });

  it('displays distance in km for each item', () => {
    render(
      <ClusterListPopup
        cluster={clusterWaypoints}
        position={{ x: 100, y: 100 }}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    // 3.1 miles * 1.60934 = ~5.0 km
    expect(screen.getByText('5.0 km')).toBeTruthy();
  });
});

describe('ClusterListSheet', () => {
  const mockOnClose = vi.fn();
  const mockOnExpand = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnExpand.mockClear();
  });

  it('renders all waypoints in the cluster', () => {
    render(
      <ClusterListSheet
        cluster={clusterWaypoints}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    expect(screen.getByText('Bag End')).toBeTruthy();
    expect(screen.getByText('The Water Bridge')).toBeTruthy();
    expect(screen.getByText('Green Hill Country')).toBeTruthy();
  });

  it('clicking overlay calls onClose', () => {
    render(
      <ClusterListSheet
        cluster={clusterWaypoints}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    const overlay = document.querySelector('.waypoint-sheet-overlay') as HTMLElement;
    fireEvent.click(overlay);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('clicking a list item calls onExpand with correct ID', () => {
    render(
      <ClusterListSheet
        cluster={clusterWaypoints}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    const item = screen.getByLabelText('View Bag End');
    fireEvent.click(item);
    expect(mockOnExpand).toHaveBeenCalledWith(1);
  });

  it('shows cluster count in header', () => {
    render(
      <ClusterListSheet
        cluster={clusterWaypoints}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
      />,
    );
    expect(screen.getByText('3 Waypoints')).toBeTruthy();
  });
});
