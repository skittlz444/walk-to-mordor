import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/preact';
import { AdminGoalsListIsland } from './AdminGoalsListIsland';

const mockFetch = vi.fn();
let savedLocation: Location;

const mockGoalsResponse = {
  goals: [
    { id: 1, title: 'Bag End', distance: 0, description: null, special: null, image_id: null, has_image: false },
    { id: 2, title: 'Weathertop', distance: 300, description: null, special: null, image_id: 'weathertop', has_image: true },
  ],
  total: 2,
  page: 1,
  pageSize: 25,
  totalPages: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => (key === 'sessionToken' ? 'admin-token' : null)),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  savedLocation = window.location;
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
    configurable: true,
  });
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockGoalsResponse),
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: savedLocation,
    writable: true,
    configurable: true,
  });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AdminGoalsListIsland', () => {
  it('renders skeleton loading state initially', () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    const { container } = render(<AdminGoalsListIsland />);

    expect(container.querySelector('.admin-goals-row--skeleton')).toBeTruthy();
  });

  it('renders goal rows after successful fetch', async () => {
    const { getByText } = render(<AdminGoalsListIsland />);

    await waitFor(() => {
      expect(getByText('Bag End')).toBeTruthy();
    });

    expect(getByText('Weathertop')).toBeTruthy();
  });

  it('shows "2 goals" count after fetch', async () => {
    const { getByText } = render(<AdminGoalsListIsland />);

    await waitFor(() => {
      expect(getByText('2 goals')).toBeTruthy();
    });
  });

  it('shows has-image indicator for goal with image', async () => {
    const { container } = render(<AdminGoalsListIsland />);

    await waitFor(() => {
      expect(container.querySelector('.admin-goals-has-image--yes')).toBeTruthy();
    });
  });

  it('shows no-image indicator for goal without image', async () => {
    const { container } = render(<AdminGoalsListIsland />);

    await waitFor(() => {
      expect(container.querySelector('.admin-goals-has-image--no')).toBeTruthy();
    });
  });

  it('renders error state when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const { getByRole, getByText } = render(<AdminGoalsListIsland />);

    await waitFor(() => {
      expect(getByRole('alert')).toBeTruthy();
    });

    expect(getByText('Failed to load goals')).toBeTruthy();
  });

  it('redirects to /login on 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });

    render(<AdminGoalsListIsland />);

    await waitFor(() => {
      expect(window.location.href).toBe('/login');
    });
  });

  it('redirects to /journey on 403', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({}),
    });

    render(<AdminGoalsListIsland />);

    await waitFor(() => {
      expect(window.location.href).toBe('/journey');
    });
  });

  it('toggles sort order when Distance column header is clicked', async () => {
    const { getByRole } = render(<AdminGoalsListIsland />);

    await waitFor(() => {
      expect(getByRole('columnheader', { name: /Distance/ })).toBeTruthy();
    });

    const distanceHeader = getByRole('columnheader', { name: /Distance/ });
    expect(distanceHeader.getAttribute('aria-sort')).toBe('ascending');

    distanceHeader.click();

    await waitFor(() => {
      expect(distanceHeader.getAttribute('aria-sort')).toBe('descending');
    });
  });

  it('navigates to goal edit page on row click', async () => {
    const { getByText } = render(<AdminGoalsListIsland />);

    await waitFor(() => {
      expect(getByText('Bag End')).toBeTruthy();
    });

    const row = getByText('Bag End').closest('tr') as HTMLElement;
    row.click();

    expect(window.location.href).toBe('/admin/goals/1');
  });

  it('navigates to goal edit page on Enter key in row', async () => {
    const { getByText } = render(<AdminGoalsListIsland />);

    await waitFor(() => {
      expect(getByText('Bag End')).toBeTruthy();
    });

    const row = getByText('Bag End').closest('tr') as HTMLElement;
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(window.location.href).toBe('/admin/goals/1');
  });

  it('fetches with correct default query params (asc order)', async () => {
    render(<AdminGoalsListIsland />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('order=asc'),
        expect.any(Object),
      );
    });
  });

  it('fetches only goals without images when the missing-image filter is enabled', async () => {
    const { getByLabelText } = render(<AdminGoalsListIsland />);

    await waitFor(() => {
      expect(getByLabelText('Only goals without images')).toBeTruthy();
    });

    const filter = getByLabelText('Only goals without images') as HTMLInputElement;
    filter.click();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('imageFilter=missing'),
        expect.any(Object),
      );
    });
  });

  it('shows pagination controls when multiple pages exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          ...mockGoalsResponse,
          total: 50,
          totalPages: 2,
        }),
    });

    const { getByText } = render(<AdminGoalsListIsland />);

    await waitFor(() => {
      expect(getByText(/Page 1 of 2/)).toBeTruthy();
    });
  });

  it('renders heading "Goal Management"', () => {
    const { getByText } = render(<AdminGoalsListIsland />);
    expect(getByText('Goal Management')).toBeTruthy();
  });

  it('renders "Add New Goal" link pointing to /admin/goals/new', async () => {
    const { getByText } = render(<AdminGoalsListIsland />);

    await waitFor(() => {
      expect(getByText(/Add New Goal/)).toBeTruthy();
    });

    const link = getByText(/Add New Goal/).closest('a') as HTMLAnchorElement;
    expect(link.href).toContain('/admin/goals/new');
  });

  it('shows empty state when no goals are returned', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ goals: [], total: 0, page: 1, pageSize: 25, totalPages: 1 }),
    });

    const { getByText } = render(<AdminGoalsListIsland />);

    await waitFor(() => {
      expect(getByText('No goals found')).toBeTruthy();
    });
  });
});
