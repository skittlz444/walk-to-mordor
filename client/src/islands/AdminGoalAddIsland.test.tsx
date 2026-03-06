import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/preact';
import { AdminGoalAddIsland } from './AdminGoalAddIsland';

const mockFetch = vi.fn();
let savedLocation: Location;

const mockGoalsListResponse = {
  goals: [
    { id: 1, title: 'Bag End', distance: 0, description: null, special: null, image_id: null },
    { id: 2, title: 'Bree', distance: 161, description: null, special: null, image_id: null },
    { id: 3, title: 'Weathertop', distance: 482, description: null, special: null, image_id: 'weathertop' },
  ],
  total: 3,
  page: 1,
  pageSize: 100,
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
  // Default: goals list fetch succeeds
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockGoalsListResponse),
  });
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, 'location', {
    value: savedLocation,
    writable: true,
    configurable: true,
  });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Wait for the initial goals list load to complete (loading spinner disappears). */
async function waitForGoalsLoaded(container: HTMLElement) {
  await waitFor(() => {
    expect(container.querySelector('.admin-loading')).toBeNull();
  });
}

describe('AdminGoalAddIsland', () => {
  it('renders the Add New Goal heading', () => {
    const { getByText } = render(<AdminGoalAddIsland />);
    expect(getByText('Add New Goal')).toBeTruthy();
  });

  it('shows validation error when title is empty on submit', async () => {
    const { getByText, container } = render(<AdminGoalAddIsland />);
    await waitForGoalsLoaded(container);

    // Provide distance but no title
    const distInput = container.querySelector('#goal-distance') as HTMLInputElement;
    fireEvent.input(distInput, { target: { value: '100' } });

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText('Title is required')).toBeTruthy();
    });
  });

  it('shows validation error when distance is empty on submit', async () => {
    const { getByText, container } = render(<AdminGoalAddIsland />);
    await waitForGoalsLoaded(container);

    // Provide title but no distance
    const titleInput = container.querySelector('#goal-title') as HTMLInputElement;
    fireEvent.input(titleInput, { target: { value: 'My Goal' } });

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText('Distance must be a positive number')).toBeTruthy();
    });
  });

  it('shows validation error for invalid image_id slug', async () => {
    const { getByText, container } = render(<AdminGoalAddIsland />);
    await waitForGoalsLoaded(container);

    fireEvent.input(container.querySelector('#goal-title') as HTMLInputElement, {
      target: { value: 'My Goal' },
    });
    fireEvent.input(container.querySelector('#goal-distance') as HTMLInputElement, {
      target: { value: '100' },
    });
    fireEvent.input(container.querySelector('#goal-image-id') as HTMLInputElement, {
      target: { value: 'Invalid Slug!' },
    });

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText(/Image ID must be a kebab-case slug/)).toBeTruthy();
    });
  });

  it('POSTs to /api/admin/goals and shows success toast on valid submit', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockGoalsListResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 99, title: 'New Goal' }),
      });

    const { getByText, container } = render(<AdminGoalAddIsland />);
    await waitForGoalsLoaded(container);

    fireEvent.input(container.querySelector('#goal-title') as HTMLInputElement, {
      target: { value: 'New Goal' },
    });
    fireEvent.input(container.querySelector('#goal-distance') as HTMLInputElement, {
      target: { value: '100' },
    });

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText(/Goal created successfully/)).toBeTruthy();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/goals',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      }),
    );
  });

  it('shows error toast when POST returns an error message', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockGoalsListResponse),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Duplicate distance' }),
      });

    const { getByText, container } = render(<AdminGoalAddIsland />);
    await waitForGoalsLoaded(container);

    fireEvent.input(container.querySelector('#goal-title') as HTMLInputElement, {
      target: { value: 'My Goal' },
    });
    fireEvent.input(container.querySelector('#goal-distance') as HTMLInputElement, {
      target: { value: '100' },
    });

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText('Duplicate distance')).toBeTruthy();
    });
  });

  it('redirects to /login when goals list fetch returns 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });

    render(<AdminGoalAddIsland />);

    await waitFor(() => {
      expect(window.location.href).toBe('/login');
    });
  });

  it('redirects to /journey when goals list fetch returns 403', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({}),
    });

    render(<AdminGoalAddIsland />);

    await waitFor(() => {
      expect(window.location.href).toBe('/journey');
    });
  });

  it('shows the markdown preview panel when Preview button is clicked', async () => {
    const { getByText, container } = render(<AdminGoalAddIsland />);
    await waitForGoalsLoaded(container);

    fireEvent.input(container.querySelector('#goal-description') as HTMLTextAreaElement, {
      target: { value: '**Bold text**' },
    });

    getByText('Preview').click();

    await waitFor(() => {
      expect(container.querySelector('.admin-goal-preview')).toBeTruthy();
    });
  });

  it('renders a "Create Goal" submit button', async () => {
    const { container } = render(<AdminGoalAddIsland />);
    await waitForGoalsLoaded(container);

    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitBtn).toBeTruthy();
    expect(submitBtn.textContent).toContain('Create Goal');
  });

  it('renders "Back to Goals" link pointing to /admin/goals', async () => {
    const { getByText } = render(<AdminGoalAddIsland />);

    await waitFor(() => {
      const link = getByText(/Back to Goals/).closest('a') as HTMLAnchorElement;
      expect(link.href).toContain('/admin/goals');
    });
  });

  it('does not clear distance error when value is Infinity', async () => {
    const { getByText, container } = render(<AdminGoalAddIsland />);
    await waitForGoalsLoaded(container);

    const titleInput = container.querySelector('#goal-title') as HTMLInputElement;
    const distInput = container.querySelector('#goal-distance') as HTMLInputElement;

    // Provide title but submit with no distance to trigger the distance error
    fireEvent.input(titleInput, { target: { value: 'My Goal' } });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText('Distance must be a positive number')).toBeTruthy();
    });

    // Enter "Infinity" — isNaN('Infinity') is false but isFinite('Infinity') is false
    // The live-validation guard should NOT clear the error for this value
    fireEvent.input(distInput, { target: { value: 'Infinity' } });

    await waitFor(() => {
      expect(getByText('Distance must be a positive number')).toBeTruthy();
    });

    // Entering a real positive value should clear the error
    fireEvent.input(distInput, { target: { value: '50' } });

    await waitFor(() => {
      expect(container.querySelector('#distance-error')).toBeNull();
    });
  });

  it('shows the distance in km hint when a valid distance is entered', async () => {
    const { container } = render(<AdminGoalAddIsland />);
    await waitForGoalsLoaded(container);

    fireEvent.input(container.querySelector('#goal-distance') as HTMLInputElement, {
      target: { value: '100' },
    });

    // 100 miles × 1.60934 = 160.934 km → displayed as 160.9 km
    await waitFor(() => {
      const hint = container.querySelector('#distance-hint') as HTMLElement;
      expect(hint.textContent).toContain('160.9 km');
    });
  });
});
